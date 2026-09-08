import "server-only";
import Stripe from "stripe";
import { Resend } from "resend";
import { DOMAINS } from "@/lib/site";
import { saldoRecordatorioEmail, saldoAcomodoEmail, saldoCierreEmail } from "@/lib/emails";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const FROM = "Árido Music Group <pedidos@aridomusicgroup.com>";

/**
 * Cuántos días esperar antes de cada toque, contados desde el toque anterior
 * (o desde la venta, para el primero).
 *
 * Se cuenta desde el ÚLTIMO CONTACTO y no desde la fecha de la venta a
 * propósito: si el toque 1 sale tarde —porque nadie entró al panel en dos
 * semanas—, el 2 no debe salir al día siguiente. Lo que importa es cuánto lleva
 * el cliente sin oír de nosotros, no cuánto lleva la venta.
 */
export const ESPERA_DIAS: Record<1 | 2 | 3, number> = { 1: 7, 2: 14, 3: 21 };

export const TOQUE_LABEL: Record<1 | 2 | 3, string> = {
  1: "Recordatorio",
  2: "Acomodo",
  3: "Cierre",
};

export const TOQUE_QUE_HACE: Record<1 | 2 | 3, string> = {
  1: "Da por hecho que se le pasó. Aquí paga la mayoría.",
  2: "Le ofrece partirlo o moverlo. Convierte al que no puede pagar y por eso te evita.",
  3: "No pide dinero: cierra y promete no volver a escribir. Prende «no contactar».",
};

export interface Deudor {
  ventaId: string;
  folio: string;
  concepto: string;
  fecha: string;
  total: number;
  cobrado: number;
  saldo: number;
  diasVenta: number;
  contactoId: string | null;
  nombre: string | null;
  email: string | null;
  noContactar: boolean;
  orderId: string | null;
  /** Toques ya enviados, en orden. */
  enviados: { toque: number; fecha: string }[];
  /** El siguiente que toca, o null si ya se agotaron los tres. */
  siguiente: 1 | 2 | 3 | null;
  /** Si ya pasó la espera para ese siguiente toque. */
  listo: boolean;
  /** Días que faltan para que esté listo (0 si ya lo está). */
  faltanDias: number;
  /** Por qué no se le puede escribir, si es el caso. */
  bloqueo: string | null;
}

const dias = (f: string) => Math.floor((Date.now() - new Date(f).getTime()) / 86400000);

/**
 * Quién debe, cuánto, y qué toque le toca.
 *
 * Se arma por VENTA y no por persona porque el saldo, el link de pago y el
 * concepto del correo son de una venta concreta — pero la pantalla lo agrupa
 * por cliente, que es como se cobra.
 */
export async function deudores(sb: SB): Promise<Deudor[]> {
  const [{ data: ventas }, { data: pagos }] = await Promise.all([
    sb.from("ventas").select("id, folio, fecha, contacto_id, total_mxn, beat_nombre, tipo").limit(1000),
    sb.from("pagos").select("venta_id, monto_mxn"),
  ]);

  const cobradoPor = new Map<string, number>();
  const tienePagos = new Set<string>();
  for (const p of pagos ?? []) {
    const id = p.venta_id as string;
    tienePagos.add(id);
    cobradoPor.set(id, (cobradoPor.get(id) ?? 0) + (Number(p.monto_mxn) || 0));
  }

  const conSaldo = (ventas ?? []).filter((v: { id: string; total_mxn: number }) => {
    // Sin pagos = cobrada, misma regla que en todo el panel. Cobrarle por una
    // venta así es el error que la pantalla de conciliación existe para evitar.
    if (!tienePagos.has(v.id)) return false;
    return (Number(v.total_mxn) || 0) - (cobradoPor.get(v.id) ?? 0) > 0.5;
  });
  if (!conSaldo.length) return [];

  const idsContacto = [...new Set(conSaldo.map((v: { contacto_id: string | null }) => v.contacto_id).filter(Boolean))] as string[];
  const idsVenta = conSaldo.map((v: { id: string }) => v.id);

  const [{ data: contactos }, { data: marcas }, { data: proys }] = await Promise.all([
    idsContacto.length
      ? sb.from("contactos").select("id, nombre, email, no_contactar").in("id", idsContacto)
      : Promise.resolve({ data: [] }),
    // Los toques ya mandados. `external_id = cobranza:<venta>:<toque>` con
    // índice único, que es lo que hace imposible mandar dos veces el mismo.
    sb.from("interacciones").select("external_id, ocurrio_at").like("external_id", "cobranza:%"),
    sb.from("proyectos").select("venta_id, order_id").in("venta_id", idsVenta),
  ]);

  type ContactoLite = { id: string; nombre: string | null; email: string | null; no_contactar: boolean | null };
  const cmap = new Map<string, ContactoLite>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (contactos ?? []).map((c: any) => [c.id as string, c as ContactoLite]),
  );
  const orderPor = new Map<string, string>();
  for (const p of proys ?? []) {
    if (p.venta_id && p.order_id) orderPor.set(p.venta_id as string, p.order_id as string);
  }
  const enviadosPor = new Map<string, { toque: number; fecha: string }[]>();
  for (const m of marcas ?? []) {
    const partes = String(m.external_id).split(":");
    if (partes.length < 3) continue;
    const vid = partes[1];
    const toque = Number(partes[2]);
    if (!vid || !Number.isFinite(toque)) continue;
    const arr = enviadosPor.get(vid) ?? [];
    arr.push({ toque, fecha: (m.ocurrio_at as string) ?? "" });
    enviadosPor.set(vid, arr);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return conSaldo.map((v: any) => {
    const total = Number(v.total_mxn) || 0;
    const cobrado = cobradoPor.get(v.id) ?? 0;
    const c = v.contacto_id ? cmap.get(v.contacto_id) : null;
    const enviados = (enviadosPor.get(v.id) ?? []).sort((a, b) => a.toque - b.toque);
    const hechos = enviados.length;
    const siguiente = hechos >= 3 ? null : ((hechos + 1) as 1 | 2 | 3);

    // Desde el último contacto; si no hay ninguno, desde la venta.
    const ultimo = enviados.length ? enviados[enviados.length - 1].fecha : v.fecha;
    const desde = ultimo ? dias(ultimo) : 0;
    const espera = siguiente ? ESPERA_DIAS[siguiente] : 0;

    const email = String(c?.email || "").trim();
    const bloqueo = !c
      ? "la venta no tiene cliente ligado"
      : c.no_contactar
        ? "está marcado como «no contactar»"
        : !email
          ? "no tiene correo registrado"
          : null;

    return {
      ventaId: v.id as string,
      folio: (v.folio as string) ?? "",
      concepto: String(v.beat_nombre || v.tipo || "tu producción"),
      fecha: v.fecha as string,
      total, cobrado, saldo: Math.round((total - cobrado) * 100) / 100,
      diasVenta: dias(v.fecha as string),
      contactoId: (v.contacto_id as string | null) ?? null,
      nombre: (c?.nombre as string | null) ?? null,
      email: email || null,
      noContactar: Boolean(c?.no_contactar),
      orderId: orderPor.get(v.id as string) ?? null,
      enviados,
      siguiente,
      listo: Boolean(siguiente) && desde >= espera && !bloqueo,
      faltanDias: Math.max(0, espera - desde),
      bloqueo,
    } as Deudor;
  }).sort((a: Deudor, b: Deudor) => {
    // Lo que ya se puede mandar primero; luego lo más viejo.
    if (a.listo !== b.listo) return a.listo ? -1 : 1;
    return b.diasVenta - a.diasVenta;
  });
}

/**
 * Link de Stripe por el saldo EXACTO de una venta.
 *
 * Aparte del de tramos (`/api/admin/cotizaciones/[id]/link-pago`) por una razón
 * comprobada: aquél elige el siguiente tramo según `cotizacion_pagos`, que sólo
 * registra pagos confirmados por Stripe. Los que hoy deben pagaron su anticipo
 * por transferencia —eso vive en `pagos`— así que ahí el tramo 1 se ve impago y
 * el link les cobraría el anticipo otra vez.
 */
export async function linkDeSaldo(
  d: { ventaId: string; folio: string; concepto: string; saldo: number },
): Promise<string | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || d.saldo <= 0.5) return null;
  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "mxn",   // la venta ya está en MXN (`total_mxn`)
          unit_amount: Math.round(d.saldo * 100),
          product_data: { name: `${d.folio} · Saldo de ${d.concepto}` },
        },
        quantity: 1,
      }],
      success_url: `${DOMAINS.main}/cotizador/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: DOMAINS.main,
      metadata: {
        tipo: "saldo_venta",
        venta_id: d.ventaId,
        saldo: String(d.saldo),
        resumen: `${d.folio} · saldo de ${d.concepto}`.slice(0, 480),
      },
    });
    return session.url ?? null;
  } catch {
    // Sin link el correo sale igual, con la cuenta y el "respóndenos este
    // correo": vale más un recordatorio sin botón que ningún recordatorio.
    return null;
  }
}

/** El correo que toca, ya armado. Exportado para poder previsualizarlo sin mandar. */
export function correoDeToque(toque: 1 | 2 | 3, d: Deudor, urlPago: string | null) {
  const datos = {
    nombre: d.nombre ? d.nombre.split(" ")[0] : null,
    concepto: d.concepto,
    folio: d.folio,
    total: d.total,
    cobrado: d.cobrado,
    saldo: d.saldo,
    urlPago,
    urlPanel: d.orderId ? `${DOMAINS.main}/cuenta/pedido/${d.orderId}` : null,
  };
  return toque === 1
    ? saldoRecordatorioEmail(datos)
    : toque === 2
      ? saldoAcomodoEmail(datos)
      : saldoCierreEmail(datos);
}

/**
 * Manda un toque y lo sella.
 *
 * El sello va DESPUÉS del envío, al contrario de los avisos internos: aquí un
 * correo perdido se puede volver a mandar sin molestar a nadie, mientras que
 * sellar antes dejaría un toque "mandado" que el cliente nunca recibió y que
 * nadie podría reintentar.
 *
 * El toque 3 prende `no_contactar`, porque ese correo promete por escrito que
 * es el último. Cumplirlo es la diferencia entre cobrar y hacer spam.
 */
export async function mandarToque(
  sb: SB,
  d: Deudor,
  toque: 1 | 2 | 3,
  actor: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  if (d.bloqueo) return { ok: false, error: `No se le puede escribir: ${d.bloqueo}.` };
  if (!d.email) return { ok: false, error: "No tiene correo registrado." };
  if (d.enviados.some((e) => e.toque === toque)) {
    return { ok: false, error: `El toque ${toque} ya se le mandó.` };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Correo no configurado (RESEND_API_KEY)." };

  const urlPago = await linkDeSaldo(d);
  const mail = correoDeToque(toque, d, urlPago);

  try {
    await new Resend(key).emails.send({ from: FROM, to: [d.email], subject: mail.subject, html: mail.html });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falló el envío." };
  }

  // El sello. Si esto falla el correo ya salió, así que se avisa pero no se
  // trata como error: lo peor sería que el panel dijera "no se mandó" y alguien
  // lo mandara otra vez.
  const { error: errSello } = await sb.from("interacciones").insert({
    contacto_id: d.contactoId,
    canal: "email",
    tipo: "cobranza",
    resumen: `Cobranza toque ${toque} (${TOQUE_LABEL[toque]}) de ${d.folio} — saldo $${Math.round(d.saldo).toLocaleString("es-MX")}`,
    external_id: `cobranza:${d.ventaId}:${toque}`,
    metadata: { toque, venta: d.folio, saldo: d.saldo, autor: actor, conLink: Boolean(urlPago) },
  });
  if (errSello) console.error("cobranza: no se pudo sellar el toque:", errSello.message);

  if (toque === 3 && d.contactoId) {
    await sb.from("contactos").update({
      no_contactar: true,
      no_contactar_motivo: `Cierre de cobranza de ${d.folio} (sin respuesta)`,
      no_contactar_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", d.contactoId);
  }

  return { ok: true, email: d.email };
}
