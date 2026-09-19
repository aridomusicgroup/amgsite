import { NextRequest, NextResponse } from "next/server";
import { aMxn } from "@/lib/tipo-cambio";
import { comisionValida, desglose, redondea } from "@/lib/comision";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nextFolio } from "@/lib/folio";
import { matchOrCreateContacto } from "@/lib/contacto-match";
import { COT_ESTADOS } from "@/lib/cotizaciones-data";
import { seguimientoAuto, DIAS_TRAS_COTIZACION } from "@/lib/seguimiento-auto";
import { CONTRACT_TIPOS } from "@/lib/pdf/contracts";
import { esEsquemaValido } from "@/lib/esquema-pago";
import { aplicaDescuentoFidelidad } from "@/lib/fidelidad";
import { nivelDeContacto, creditoDisponible, aplicarCredito } from "@/lib/fidelidad-server";
import { limpiarTemas } from "@/lib/temas";
import { costoSugerido, llevaDiseno, validarCosto } from "@/lib/diseno";
import { catalogoDiseno } from "@/lib/diseno-catalogo";

const TIPOS_VALIDOS = new Set(CONTRACT_TIPOS.map((t) => t.id));

export const dynamic = "force-dynamic";

interface ItemIn { label?: unknown; qty?: unknown; unitPrice?: unknown }

/** Normaliza y valida los line items del cuerpo. */
function parseItems(v: unknown): { label: string; qty: number; unitPrice: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: ItemIn) => ({
      label: String(x?.label ?? "").trim(),
      qty: Math.max(0, Number(x?.qty) || 0),
      unitPrice: Math.max(0, Number(x?.unitPrice) || 0),
    }))
    .filter((i) => i.label);
}

/** Quién toca cada instrumento: [{instrumento, musico_id}] limpio. */
function parseMusicos(v: unknown): { instrumento: string; musico_id: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e: { instrumento?: unknown; musico_id?: unknown }) => ({
      instrumento: String(e?.instrumento ?? "").trim().slice(0, 60),
      musico_id: String(e?.musico_id ?? "").trim(),
    }))
    .filter((e) => e.instrumento && /^[0-9a-f-]{36}$/i.test(e.musico_id))
    .slice(0, 30);
}

/** El proyecto (canción) de origen de un diseño: id válido y que exista, o null. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function origenValido(sb: any, v: unknown): Promise<string | null> {
  const id = String(v ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await sb.from("proyectos").select("id").eq("id", id).maybeSingle();
  return data ? id : null;
}

/**
 * Lo que se le paga al diseñador (MXN). Lo que escribió el staff si lo mandó;
 * si no, lo que sale del catálogo por los conceptos de diseño; null si la
 * cotización no lleva diseño. Se valida contra el total en pesos.
 */
function costoProveedorDe(
  pedido: unknown,
  items: { label: string; qty: number }[],
  totalMxn: number,
): { costo: number | null; error: string | null } {
  const catalogo = catalogoDiseno();
  const vacio = pedido === undefined || pedido === null || pedido === "";
  if (vacio && !llevaDiseno(items, catalogo)) return { costo: null, error: null };
  const costo = vacio ? costoSugerido(items, catalogo) : Number(pedido);
  const error = validarCosto(costo, totalMxn);
  return { costo: error ? null : redondea(costo), error };
}

/** Columnas de diseño (supabase-diseno.sql): las más nuevas, las primeras en soltarse. */
const COLS_DISENO = ["proyecto_origen_id", "costo_proveedor"];
const sinCols = (o: Record<string, unknown>, cols: string[]) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !cols.includes(k)));
const AVISO_SQL_DISENO = "Se guardó, pero sin el tema de origen ni el pago a Julio: falta correr supabase-diseno.sql.";

// El total (con comisión de PayPal si aplica) vive en `lib/comision.ts`, no aquí:
// lo tienen que calcular igual el formulario, esta ruta y el PDF que firma el
// cliente.

// Cotizaciones: acceso para staff (admin o crm/Tozi).
async function staff(): Promise<string | null> {
  const s = await getSession();
  return s && (s.role === "admin" || s.role === "crm") ? s.email : null;
}

export async function POST(req: NextRequest) {
  const email = await staff();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const items = parseItems(b.items);
  if (items.length === 0) return NextResponse.json({ error: "Agrega al menos un concepto." }, { status: 400 });

  const descuento = Math.max(0, Number(b.descuento) || 0);
  const moneda = String(b.moneda || "MXN").toUpperCase().slice(0, 4);
  const tipoCambio = Number(b.tipo_cambio) > 0 ? Number(b.tipo_cambio) : null;
  const comisionPct = comisionValida(b.comision_pct);
  const estado = COT_ESTADOS.includes(b.estado) ? b.estado : "borrador";
  const tipo = TIPOS_VALIDOS.has(b.tipo) ? String(b.tipo) : null;
  const esquemaPago = esEsquemaValido(b.esquema_pago) ? b.esquema_pago : null;
  const numCanciones = esquemaPago === "por_cancion" || tipo === "ep_album" ? Math.max(1, Number(b.num_canciones) || 1) : null;
  // Un EP/álbum siempre es uno de los dos: sin formato, ni la venta por Stripe
  // sabía qué proyecto armar (le pasó a COT-0063). Si no viene, es EP.
  const epAlbumFormato = tipo === "ep_album" ? (b.ep_album_formato === "album" ? "album" : "ep") : null;
  const temas = tipo === "ep_album" ? limpiarTemas(b.temas) : null;
  const sinDescuentoFidelidad = !!b.sin_descuento_fidelidad;

  const sb = supabaseAdmin();

  // ── Contacto: liga el elegido o crea/une por email→teléfono→nombre.
  //    Una cotización SIEMPRE aterriza un contacto en el CRM.
  const direccion = (b.cliente_direccion || "").trim();
  let contactoId: string | null = b.contacto_id || null;
  if (contactoId) {
    // Rellena la dirección en la ficha si no la tenía (sin pisar).
    if (direccion) {
      const { data: cur } = await sb.from("contactos").select("direccion").eq("id", contactoId).single();
      if (cur && !cur.direccion) {
        await sb.from("contactos").update({ direccion, updated_at: new Date().toISOString() }).eq("id", contactoId);
      }
    }
  } else {
    contactoId = await matchOrCreateContacto(sb, {
      nombre: b.cliente_nombre, email: b.cliente_email, telefono: b.cliente_telefono, direccion,
    });
  }

  // ── Fidelidad: el % SIEMPRE se recalcula aquí, en el servidor, contra el
  //    nivel ACTUAL del contacto — nunca se confía en un % que mande el
  //    navegador (el cliente podría inflarlo). Solo aplica a "de contado" en
  //    servicios a la medida; las licencias de catálogo no llevan descuento
  //    propio aunque sí suman nivel (eso pasa en ventas/route.ts). El staff
  //    puede apagarlo a propósito con `sin_descuento_fidelidad` (caso especial:
  //    igual se cobra el 100% aunque calificara).
  const fidelidadAplica = esquemaPago === "contado" && aplicaDescuentoFidelidad(tipo) && !sinDescuentoFidelidad;
  const fidelidadPct = fidelidadAplica ? (await nivelDeContacto(sb, contactoId)).descuentoPct : 0;

  const d = desglose(items, descuento, comisionPct, fidelidadPct);

  // ── Crédito gastable: el navegador solo puede pedir "aplícalo", nunca decir
  //    cuánto vale — el monto disponible se vuelve a leer aquí.
  const disponible = b.aplicar_credito ? await creditoDisponible(sb, contactoId) : 0;
  const creditoAUsar = Math.min(disponible, d.total);
  const total = redondea(d.total - creditoAUsar);

  // ── Diseño visual: el tema que produjimos y lo que se le paga al diseñador.
  const totalMxn = aMxn(total, moneda, tipoCambio ?? 0);
  const proveedor = costoProveedorDe(b.costo_proveedor, items, totalMxn);
  if (proveedor.error) return NextResponse.json({ error: proveedor.error }, { status: 400 });
  const origenId = await origenValido(sb, b.proyecto_origen_id);

  const folio = await nextFolio(sb, "cotizaciones", "COT-");
  const row: Record<string, unknown> = {
    folio,
    tipo,
    esquema_pago: esquemaPago,
    num_canciones: numCanciones,
    ep_album_formato: epAlbumFormato,
    contacto_id: contactoId,
    cliente_nombre: (b.cliente_nombre || "").trim() || null,
    cliente_email: (b.cliente_email || "").trim().toLowerCase() || null,
    cliente_telefono: (b.cliente_telefono || "").trim() || null,
    cliente_direccion: (b.cliente_direccion || "").trim() || null,
    moneda,
    tipo_cambio: tipoCambio,
    comision_pct: comisionPct,
    items,
    descuento,
    descuento_fidelidad: d.descuentoFidelidad,
    credito_aplicado: creditoAUsar,
    sin_descuento_fidelidad: sinDescuentoFidelidad,
    musicos: parseMusicos(b.musicos),
    temas,
    total,
    // Espejo en pesos: es lo que leen el Dashboard y Finanzas, que reportan
    // todo en MXN. Se guarda calculado (y no se recalcula al vuelo) para que la
    // cotización conserve el tipo de cambio con el que se hizo.
    total_mxn: totalMxn,
    notas: (b.notas || "").trim() || null,
    vigencia_dias: Math.max(1, Number(b.vigencia_dias) || 15),
    estado,
    creado_por: email,
  };
  // Sólo si hay algo que guardar: así una cotización normal no depende de que
  // ya exista la columna.
  if (origenId) row.proyecto_origen_id = origenId;
  if (proveedor.costo !== null) row.costo_proveedor = proveedor.costo;

  // `tipo`/`esquema_pago`/`num_canciones`/`descuento_fidelidad`/`credito_aplicado`
  // son columnas nuevas. Si todavía no se corrieron esas migraciones, no se
  // puede tirar la creación de la cotización entera por eso — se reintenta sin
  // ellas para no dejar el flujo principal roto mientras tanto.
  let { data, error } = await sb.from("cotizaciones").insert(row).select("id, folio").single();
  const conDiseno = COLS_DISENO.some((k) => k in row);
  let soltoDiseno = false;
  if (error && /schema cache/i.test(error.message) && conDiseno) {
    // Primero sin las de diseño (las más nuevas): no perder por ellas todo lo demás.
    soltoDiseno = true;
    ({ data, error } = await sb.from("cotizaciones").insert(sinCols(row, COLS_DISENO)).select("id, folio").single());
  }
  if (error && /schema cache/i.test(error.message)) {
    // Luego sin `temas`.
    ({ data, error } = await sb.from("cotizaciones").insert(sinCols(row, [...COLS_DISENO, "temas"])).select("id, folio").single());
  }
  if (error && /schema cache/i.test(error.message)) {
    const viejas = ["tipo", "esquema_pago", "num_canciones", "descuento_fidelidad", "credito_aplicado", "ep_album_formato", "sin_descuento_fidelidad", "musicos", "temas"];
    ({ data, error } = await sb.from("cotizaciones").insert(sinCols(row, [...COLS_DISENO, ...viejas])).select("id, folio").single());
  }

  if (error || !data) return NextResponse.json({ error: error?.message || "No se pudo crear." }, { status: 500 });
  const aviso = soltoDiseno ? AVISO_SQL_DISENO : null;

  // Sella el crédito usado DESPUÉS de que la cotización ya existe (necesita su id).
  if (contactoId && creditoAUsar > 0.5) {
    await aplicarCredito(sb, contactoId, data.id, creditoAUsar);
  }

  // Solo si nace ya enviada. Si es borrador, el seguimiento lo arma la ruta
  // `enviar` cuando de verdad salga.
  if (estado !== "borrador") {
    await seguimientoAuto(sb, {
      contactoId,
      accion: `Dar seguimiento a la cotización ${data.folio}`,
      dias: DIAS_TRAS_COTIZACION,
      motivo: `se creó ${data.folio}`,
      actor: email,
    });
  }

  return NextResponse.json({ ok: true, id: data.id, folio: data.folio, aviso });
}

export async function PATCH(req: NextRequest) {
  const email = await staff();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["cliente_nombre", "cliente_email", "cliente_telefono", "cliente_direccion", "notas", "contacto_id"]) {
    if (k in b) patch[k] = b[k] ? String(b[k]).trim() : null;
  }
  if ("moneda" in b) patch.moneda = String(b.moneda || "MXN").toUpperCase().slice(0, 4);
  if ("tipo_cambio" in b) patch.tipo_cambio = Number(b.tipo_cambio) > 0 ? Number(b.tipo_cambio) : null;
  if ("comision_pct" in b) patch.comision_pct = comisionValida(b.comision_pct);
  if ("vigencia_dias" in b) patch.vigencia_dias = Math.max(1, Number(b.vigencia_dias) || 15);
  if (b.estado && COT_ESTADOS.includes(b.estado)) patch.estado = b.estado;
  if ("tipo" in b) patch.tipo = TIPOS_VALIDOS.has(b.tipo) ? String(b.tipo) : null;
  if ("esquema_pago" in b) {
    const esquemaPago = esEsquemaValido(b.esquema_pago) ? b.esquema_pago : null;
    patch.esquema_pago = esquemaPago;
    // El tipo siempre viaja en el mismo PATCH que esquema_pago (el modal manda
    // los dos juntos) — por eso basta leerlo de `patch`, ya se resolvió arriba.
    const tipoParaCanciones = "tipo" in patch ? (patch.tipo as string | null) : null;
    patch.num_canciones = esquemaPago === "por_cancion" || tipoParaCanciones === "ep_album"
      ? Math.max(1, Number(b.num_canciones) || 1)
      : null;
  }
  if ("ep_album_formato" in b) {
    const esEpAlbum = "tipo" in patch ? patch.tipo === "ep_album" : true;
    patch.ep_album_formato = esEpAlbum ? (b.ep_album_formato === "album" ? "album" : "ep") : null;
  }
  if ("temas" in b) patch.temas = limpiarTemas(b.temas);
  if ("sin_descuento_fidelidad" in b) patch.sin_descuento_fidelidad = !!b.sin_descuento_fidelidad;
  if ("musicos" in b) patch.musicos = parseMusicos(b.musicos);

  const sb = supabaseAdmin();

  // El total se rehace si cambió cualquiera de sus ingredientes — conceptos,
  // descuento, comisión, o cualquier cosa que mueva el descuento de fidelidad
  // (tipo, esquema de pago, el contacto mismo porque cada quien tiene su propio
  // nivel, o el interruptor manual de apagarlo). Lo que no venga en el cuerpo
  // se lee de la fila actual.
  const disparaRecalculo = ["items", "descuento", "comision_pct", "tipo", "esquema_pago", "contacto_id", "sin_descuento_fidelidad"].some((k) => k in b);
  if (disparaRecalculo) {
    const { data: cur } = await sb.from("cotizaciones")
      .select("items, descuento, comision_pct, tipo, esquema_pago, contacto_id, sin_descuento_fidelidad").eq("id", id).single();
    const items = "items" in b ? parseItems(b.items) : parseItems(cur?.items);
    const descuento = "descuento" in b ? Math.max(0, Number(b.descuento) || 0) : Number(cur?.descuento) || 0;
    const pct = "comision_pct" in b ? comisionValida(b.comision_pct) : comisionValida(cur?.comision_pct);
    const tipoActual = "tipo" in patch ? (patch.tipo as string | null) : ((cur?.tipo as string | null) ?? null);
    const esquemaActual = "esquema_pago" in patch ? (patch.esquema_pago as string | null) : ((cur?.esquema_pago as string | null) ?? null);
    const contactoActual = "contacto_id" in patch ? (patch.contacto_id as string | null) : ((cur?.contacto_id as string | null) ?? null);
    const sinDescuentoActual = "sin_descuento_fidelidad" in patch ? !!patch.sin_descuento_fidelidad : !!cur?.sin_descuento_fidelidad;

    const fidelidadAplica = esquemaActual === "contado" && aplicaDescuentoFidelidad(tipoActual) && !sinDescuentoActual;
    const fidelidadPct = fidelidadAplica ? (await nivelDeContacto(sb, contactoActual)).descuentoPct : 0;
    const d = desglose(items, descuento, pct, fidelidadPct);

    patch.items = items;
    patch.descuento = descuento;
    patch.descuento_fidelidad = d.descuentoFidelidad;
    patch.total = d.total;
  }

  // El espejo en pesos se rehace si cambió cualquiera de sus tres ingredientes.
  // Lo que no venga en el cuerpo se lee de la fila actual: un PATCH que solo
  // toca el tipo de cambio también tiene que dejar bien el total en pesos.
  if ("total" in patch || "moneda" in patch || "tipo_cambio" in patch) {
    const { data: cur } = await sb.from("cotizaciones").select("total, moneda, tipo_cambio").eq("id", id).single();
    patch.total_mxn = aMxn(
      Number(patch.total ?? cur?.total) || 0,
      (patch.moneda as string) ?? cur?.moneda,
      Number(patch.tipo_cambio ?? cur?.tipo_cambio) || 0,
    );
  }

  // ── Diseño visual: tema de origen y pago al diseñador, contra el total YA recalculado.
  if ("proyecto_origen_id" in b) patch.proyecto_origen_id = await origenValido(sb, b.proyecto_origen_id);
  if ("costo_proveedor" in b) {
    let items = patch.items as { label: string; qty: number }[] | undefined;
    let totalMxn = patch.total_mxn as number | undefined;
    if (items === undefined || totalMxn === undefined) {
      const { data: cur } = await sb.from("cotizaciones").select("items, total_mxn").eq("id", id).single();
      items ??= parseItems(cur?.items);
      totalMxn ??= Number(cur?.total_mxn) || 0;
    }
    const proveedor = costoProveedorDe(b.costo_proveedor, items, totalMxn);
    if (proveedor.error) return NextResponse.json({ error: proveedor.error }, { status: 400 });
    patch.costo_proveedor = proveedor.costo;
  }

  let { error } = await sb.from("cotizaciones").update(patch).eq("id", id);
  let soltoDiseno = false;
  if (error && /schema cache/i.test(error.message) && COLS_DISENO.some((k) => k in patch)) {
    soltoDiseno = true;
    ({ error } = await sb.from("cotizaciones").update(sinCols(patch, COLS_DISENO)).eq("id", id));
  }
  if (error && /schema cache/i.test(error.message) && "temas" in patch) {
    ({ error } = await sb.from("cotizaciones").update(sinCols(patch, [...COLS_DISENO, "temas"])).eq("id", id));
  }
  if (error && /schema cache/i.test(error.message)) {
    const viejas = ["tipo", "esquema_pago", "num_canciones", "descuento_fidelidad", "credito_aplicado", "ep_album_formato", "sin_descuento_fidelidad", "musicos", "temas"];
    ({ error } = await sb.from("cotizaciones").update(sinCols(patch, [...COLS_DISENO, ...viejas])).eq("id", id));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Sin la migración, que el panel lo diga en vez de perder el pago a Julio en silencio.
  const pidioDiseno = !!b.proyecto_origen_id || Number(patch.costo_proveedor) > 0;
  return NextResponse.json({ ok: true, aviso: soltoDiseno && pidioDiseno ? AVISO_SQL_DISENO : null });
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = String(new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  const sb = supabaseAdmin();
  const { error } = await sb.from("cotizaciones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
