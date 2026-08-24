import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leerTransacciones, tipoDeVenta, folioDe, type TxBeatStars } from "@/lib/beatstars-tx";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Importa el histórico de VENTAS de BeatStars (reporte de Transactions).
 *
 * Siempre corre primero en seco: devuelve el resumen de lo que haría y no
 * escribe nada. Solo con `confirmar: true` inserta. Son ventas —dinero— y una
 * importación masiva no se deshace con un botón.
 *
 * No duplica: el folio de cada venta se arma con el folio de BeatStars
 * (`BS-<invoice>`), que es único. Volver a subir el mismo archivo no crea nada.
 *
 * `monto_cobrado` guarda el NETO en dólares —lo que de verdad llega tras la
 * comisión de BeatStars— porque así están capturadas las ventas que ya existen
 * en el panel (una licencia básica aparece como 42.05 USD, no como los 56 que
 * pagó el cliente).
 */
export async function POST(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const csv = typeof b.csv === "string" ? b.csv : "";
  const tipoCambio = Number(b.tipoCambio) || 0;
  const confirmar = b.confirmar === true;
  if (!csv) return NextResponse.json({ error: "Falta el contenido del CSV." }, { status: 400 });
  if (!(tipoCambio > 0)) return NextResponse.json({ error: "Pon un tipo de cambio válido." }, { status: 400 });

  const { tx, ignoradas } = leerTransacciones(csv);
  if (!tx.length) {
    return NextResponse.json(
      { error: "No encontré transacciones. ¿Es el reporte de Transactions de BeatStars?" },
      { status: 400 },
    );
  }

  // Folio único por línea (una factura puede traer dos beats).
  const conteo = new Map<string, number>();
  const conFolio = tx.map((t) => {
    const n = (conteo.get(t.invoice) ?? 0) + 1;
    conteo.set(t.invoice, n);
    return { t, folio: folioDe(t, n) };
  });

  const sb = supabaseAdmin();

  // Lo ya importado se detecta por folio: es lo que hace repetible la subida.
  const folios = conFolio.map((x) => x.folio);
  const yaFolios = new Set<string>();
  for (let i = 0; i < folios.length; i += 200) {
    const { data } = await sb.from("ventas").select("folio").in("folio", folios.slice(i, i + 200));
    for (const v of data ?? []) if (v.folio) yaFolios.add(v.folio as string);
  }
  const pendientes = conFolio.filter((x) => !yaFolios.has(x.folio));

  // Contactos por correo
  const { data: cts } = await sb.from("contactos").select("id, email, nombre").is("merged_into", null);
  const porEmail = new Map<string, { id: string; nombre: string | null }>();
  for (const c of cts ?? []) if (c.email) porEmail.set(String(c.email).toLowerCase(), { id: c.id as string, nombre: c.nombre as string | null });

  const correosPend = [...new Set(pendientes.map((x) => x.t.email).filter((e) => e.includes("@")))];
  const correosNuevos = correosPend.filter((e) => !porEmail.has(e));

  const mxn = (t: TxBeatStars) => Math.round(t.neto * tipoCambio * 100) / 100;
  const porTipo: Record<string, number> = {};
  for (const { t } of pendientes) {
    const k = tipoDeVenta(t.neto);
    porTipo[k] = (porTipo[k] ?? 0) + 1;
  }
  const fechas = pendientes.map((x) => x.t.fecha).filter(Boolean).sort() as string[];

  const resumen = {
    leidas: tx.length,
    ignoradas,
    yaImportadas: yaFolios.size,
    aCrear: pendientes.length,
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
    usdPagado: Math.round(pendientes.reduce((a, x) => a + x.t.pagado, 0) * 100) / 100,
    usdNeto: Math.round(pendientes.reduce((a, x) => a + x.t.neto, 0) * 100) / 100,
    usdComision: Math.round(pendientes.reduce((a, x) => a + x.t.comision, 0) * 100) / 100,
    totalMxn: Math.round(pendientes.reduce((a, x) => a + mxn(x.t), 0) * 100) / 100,
    tipoCambio,
    contactosExistentes: correosPend.length - correosNuevos.length,
    contactosNuevos: correosNuevos.length,
    beatsDistintos: new Set(pendientes.map((x) => x.t.beat)).size,
    porTipo,
    muestra: pendientes.slice(0, 6).map((x) => ({
      fecha: x.t.fecha, cliente: x.t.cliente || "(sin nombre)", beat: x.t.beat,
      tipo: tipoDeVenta(x.t.neto), usd: x.t.neto, mxn: mxn(x.t),
    })),
  };

  if (!confirmar) return NextResponse.json({ ok: true, dryRun: true, resumen });
  if (!pendientes.length) return NextResponse.json({ ok: true, dryRun: false, resumen, creadas: 0 });

  // ── 1. Contactos que faltan ──────────────────────────────────────────────
  if (correosNuevos.length) {
    const nombrePorCorreo = new Map<string, string>();
    for (const { t } of pendientes) if (t.cliente && !nombrePorCorreo.has(t.email)) nombrePorCorreo.set(t.email, t.cliente);
    const { data: creados, error } = await sb
      .from("contactos")
      .insert(correosNuevos.map((e) => ({
        nombre: nombrePorCorreo.get(e) ?? null, email: e, etapa: "cliente", origen: "beatstars",
      })))
      .select("id, email");
    if (error) return NextResponse.json({ error: `Contactos: ${error.message}` }, { status: 500 });
    for (const c of creados ?? []) if (c.email) porEmail.set(String(c.email).toLowerCase(), { id: c.id as string, nombre: null });
  }

  // ── 2. Las ventas ────────────────────────────────────────────────────────
  const filas = pendientes.map(({ t, folio }) => ({
    folio,
    fecha: t.fecha,
    contacto_id: porEmail.get(t.email)?.id ?? null,
    tipo: tipoDeVenta(t.neto),
    beat_nombre: t.beat,
    canal: "beatstars",
    moneda: "USD",
    monto_cobrado: t.neto,
    tipo_cambio: tipoCambio,
    total_mxn: mxn(t),
    medio_pago: "BeatStars",
    quien_cerro: "BeatStars",
  })).filter((f) => f.fecha);

  let creadas = 0;
  for (let i = 0; i < filas.length; i += 100) {
    const { error, count } = await sb.from("ventas").insert(filas.slice(i, i + 100), { count: "exact" });
    if (error) return NextResponse.json({ error: `Ventas: ${error.message}`, creadas }, { status: 500 });
    creadas += count ?? 0;
  }

  // ── 3. LTV y etapa de cada cliente ───────────────────────────────────────
  // No hay trigger en la base: el LTV lo recalcula siempre la aplicación (ver
  // `recalcContacto` en /api/admin/ventas). Sin esto, el CRM mostraría a estos
  // clientes en $0 aunque sus ventas ya estén adentro.
  const afectados = [...new Set(filas.map((f) => f.contacto_id).filter(Boolean))] as string[];
  for (const id of afectados) {
    const { data: vts } = await sb.from("ventas").select("total_mxn").eq("contacto_id", id);
    const suma = (vts ?? []).reduce((a: number, v: { total_mxn: number }) => a + (Number(v.total_mxn) || 0), 0);
    const n = (vts ?? []).length;
    const patch: Record<string, unknown> = { ltv: suma, updated_at: new Date().toISOString() };
    if (n >= 1) patch.etapa = n > 1 ? "recurrente" : "cliente";
    await sb.from("contactos").update(patch).eq("id", id);
  }

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "venta_creada",
      titulo: `${quien} importó ${creadas} ventas históricas de BeatStars (${resumen.desde} a ${resumen.hasta})`,
      actor, entidad: "venta",
      meta: { creadas, totalMxn: resumen.totalMxn, tipoCambio, contactosNuevos: correosNuevos.length },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, dryRun: false, resumen, creadas, contactosCreados: correosNuevos.length, clientesActualizados: afectados.length });
}
