import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";
import { cambiarMusicoDeVenta } from "@/lib/musico-asignar";
import { limpiarAbonos, totalAbonado, type AbonoMusico } from "@/lib/abonos-musico";

export const dynamic = "force-dynamic";

const peso = (n: unknown) => `$${(Number(n) || 0).toLocaleString("es-MX")}`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Recalcula `ventas.costo_extra` = SUMA de los pagos a músicos de esa venta.
 * Es la clave para no doble-contar: el reparto sigue leyendo costo_extra igual
 * que siempre, pero ahora está respaldado por pagos itemizados y trazables.
 */
async function recomputeCostoExtra(sb: SB, ventaId: string): Promise<number> {
  const { data } = await sb.from("pagos_musico").select("monto").eq("venta_id", ventaId);
  const sum = (data ?? []).reduce((a: number, r: { monto: unknown }) => a + (Number(r.monto) || 0), 0);
  await sb.from("ventas").update({ costo_extra: sum }).eq("id", ventaId);
  return sum;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

/** El músico del catálogo con ese nombre, y su instrumento si toca uno solo. */
async function delCatalogo(sb: SB, nombre: string): Promise<{ id: string; instrumento: string | null } | null> {
  const { data } = await sb.from("musicos").select("id, nombre, instrumentos");
  const m = (data ?? []).find((x: { nombre: string }) => norm(String(x.nombre)) === norm(nombre));
  if (!m) return null;
  const inst = (m.instrumentos as string[] | null) ?? [];
  return { id: m.id as string, instrumento: inst.length === 1 ? inst[0] : null };
}

const FALTA_SQL = "Para anticipos falta correr supabase-pagos-musico-anticipos.sql.";
const faltaColumnaAbonos = (msg: string) => /abonos/i.test(msg);

/** Un anticipo tal como llega del formulario. null si no trae monto. */
function abonoDe(b: { monto?: unknown; medio_pago?: unknown; fecha?: unknown } | null | undefined): AbonoMusico | null {
  const monto = Math.round((Number(b?.monto) || 0) * 100) / 100;
  if (!(monto > 0)) return null;
  return {
    monto,
    medio_pago: String(b?.medio_pago || "").trim() || null,
    fecha: String(b?.fecha || "").trim() || new Date().toISOString().slice(0, 10),
  };
}

async function folioDeVenta(sb: SB, ventaId: string): Promise<string> {
  const { data: v } = await sb.from("ventas").select("folio, beat_nombre").eq("id", ventaId).single();
  return (v?.folio as string) || (v?.beat_nombre as string) || "venta";
}

// ── GET ?venta_id= : lista de pagos de una venta · ?names=1 : músicos usados ──
export async function GET(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const url = new URL(req.url);

  // Lista de nombres de músicos ya usados (para autocompletar). Dedup + ordenado.
  if (url.searchParams.get("names")) {
    const sb = supabaseAdmin();
    const { data } = await sb.from("pagos_musico").select("musico").not("musico", "is", null);
    const set = new Set<string>();
    for (const r of data ?? []) { const n = String(r.musico || "").trim(); if (n) set.add(n); }
    return NextResponse.json({ names: [...set].sort((a, b) => a.localeCompare(b, "es")) });
  }

  const ventaId = String(url.searchParams.get("venta_id") || "").trim();
  if (!ventaId) return NextResponse.json({ error: "Falta venta_id." }, { status: 400 });

  const sb = supabaseAdmin();
  const lista = (cols: string) => sb.from("pagos_musico").select(cols).eq("venta_id", ventaId).order("created_at", { ascending: true });
  let { data, error } = await lista("id, venta_id, musico, musico_id, instrumento, monto, fecha, medio_pago, pagado, nota, abonos");
  if (error) ({ data, error } = await lista("id, venta_id, musico, musico_id, instrumento, monto, fecha, medio_pago, pagado, nota"));
  if (error) ({ data, error } = await lista("id, venta_id, musico, monto, fecha, medio_pago, pagado, nota"));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pagos: data ?? [] });
}

// ── POST : registra un pago a músico ──
export async function POST(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const ventaId = String(b.venta_id || "").trim();
  const monto = Number(b.monto);
  if (!ventaId || !(monto > 0)) return NextResponse.json({ error: "Faltan datos (venta o monto)." }, { status: 400 });

  const sb = supabaseAdmin();
  const nombre = String(b.musico || "").trim() || null;
  // Se liga al catálogo. Capturado sólo con el nombre, "Asignar a un músico" no
  // lo reconocía como contratado ni sabía qué instrumento tocaba (pasó en I0085).
  const cat = nombre ? await delCatalogo(sb, nombre) : null;
  // Anticipo: se le dio sólo una parte. Si cubre todo, es un pago completo.
  const anticipo = b.pagado === false ? abonoDe({ monto: b.anticipo, medio_pago: b.anticipo_medio, fecha: b.anticipo_fecha }) : null;
  if (anticipo && !anticipo.medio_pago) return NextResponse.json({ error: "Elige cómo se le dio el anticipo." }, { status: 400 });
  const liquidado = anticipo !== null && anticipo.monto >= monto;
  const fila: Record<string, unknown> = {
    venta_id: ventaId,
    musico: nombre,
    musico_id: cat?.id ?? null,
    instrumento: String(b.instrumento || "").trim() || cat?.instrumento || null,
    monto,
    fecha: b.fecha || null,
    medio_pago: (b.medio_pago || "").trim() || null,
    pagado: b.pagado === undefined ? true : Boolean(b.pagado),
    nota: (b.nota || "").trim() || null,
  };
  if (liquidado) Object.assign(fila, { pagado: true, medio_pago: anticipo!.medio_pago, fecha: anticipo!.fecha });
  else if (anticipo) fila.abonos = [anticipo];
  let { error } = await sb.from("pagos_musico").insert(fila);
  if (error && anticipo && !liquidado && faltaColumnaAbonos(error.message)) {
    return NextResponse.json({ error: FALTA_SQL }, { status: 503 });
  }
  if (error && /schema cache/i.test(error.message)) {
    const { musico_id: _i, instrumento: _n, ...viejo } = fila;
    void _i; void _n;
    ({ error } = await sb.from("pagos_musico").insert(viejo));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = await recomputeCostoExtra(sb, ventaId);

  try {
    const quien = await nombreDeActor(sb, actor);
    const folio = await folioDeVenta(sb, ventaId);
    await registrarActividad(sb, {
      tipo: "pago_musico_registrado",
      titulo: `${quien} registró un pago a músico ${b.musico ? `(${b.musico}) ` : ""}de ${peso(monto)} en ${folio}${
        anticipo && !liquidado ? ` · anticipo de ${peso(anticipo.monto)}` : b.pagado === false ? " · PENDIENTE" : ""}`,
      actor, entidad: "musico", entidad_id: ventaId, entidad_nombre: folio,
      meta: { monto, musico: b.musico ?? null, pagado: b.pagado !== false },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, costo_extra: total });
}

// ── PATCH : edita un pago (incluye marcar pagado/pendiente) ──
export async function PATCH(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  // Anticipo / abono: se le da una parte de lo que se le debe.
  if (b.abono) return registrarAbono(actor, id, b.abono);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("musico" in b) patch.musico = b.musico ? String(b.musico).trim() : null;
  if (b.monto !== undefined && b.monto !== "") patch.monto = Number(b.monto) || 0;
  if ("fecha" in b) patch.fecha = b.fecha || null;
  if ("medio_pago" in b) patch.medio_pago = b.medio_pago ? String(b.medio_pago).trim() : null;
  if ("pagado" in b) patch.pagado = Boolean(b.pagado);
  if ("nota" in b) patch.nota = b.nota ? String(b.nota).trim() : null;

  const sb = supabaseAdmin();

  // Cambiar de músico: se toma del catálogo y el cambio se lleva a sus tareas
  // y a su portal (cambiarMusicoDeVenta). "Que se actualice en todos lados."
  let cambio: { anteriorId: string | null; nuevoId: string; instrumento: string } | null = null;
  if (b.musico_id) {
    const [{ data: m }, { data: prev }] = await Promise.all([
      sb.from("musicos").select("id, nombre, instrumentos, tarifa").eq("id", String(b.musico_id).trim()).maybeSingle(),
      sb.from("pagos_musico").select("musico, musico_id, instrumento, monto, pagado").eq("id", id).maybeSingle(),
    ]);
    if (!m) return NextResponse.json({ error: "Ese músico no está en el catálogo." }, { status: 404 });
    if (!prev) return NextResponse.json({ error: "Ese pago ya no existe." }, { status: 404 });
    const suyos = (m.instrumentos as string[] | null) ?? [];
    const instrumento = String(prev.instrumento || "").trim() || (suyos.length === 1 ? suyos[0] : "");
    const anteriorId = (prev.musico_id as string | null) ?? (prev.musico ? (await delCatalogo(sb, String(prev.musico)))?.id ?? null : null);
    patch.musico = m.nombre;
    patch.musico_id = m.id;
    if (instrumento) patch.instrumento = instrumento;
    // Pendiente y con la tarifa del anterior → la del nuevo. Un monto puesto a
    // mano, o uno ya pagado, no se toca.
    if (!prev.pagado && b.monto === undefined && anteriorId && Number(m.tarifa) > 0) {
      const { data: ant } = await sb.from("musicos").select("tarifa").eq("id", anteriorId).maybeSingle();
      if (ant && Number(ant.tarifa) === Number(prev.monto)) patch.monto = Number(m.tarifa);
    }
    if (anteriorId !== m.id) cambio = { anteriorId, nuevoId: m.id as string, instrumento };
  }

  const { data: upd, error } = await sb.from("pagos_musico").update(patch).eq("id", id).select("venta_id, musico").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Volver a pendiente borra los anticipos: si no, quedaría "pendiente" sin deber nada.
  if (patch.pagado === false) await sb.from("pagos_musico").update({ abonos: [] }).eq("id", id);

  const ventaId = upd?.venta_id as string;
  const total = ventaId ? await recomputeCostoExtra(sb, ventaId) : 0;
  const movido = cambio && ventaId
    ? await cambiarMusicoDeVenta(sb, ventaId, cambio.anteriorId, cambio.nuevoId, cambio.instrumento, actor)
    : null;

  try {
    const quien = await nombreDeActor(sb, actor);
    const folio = ventaId ? await folioDeVenta(sb, ventaId) : "venta";
    const que = cambio ? `cambiado a ${patch.musico}`
      : "pagado" in patch ? (patch.pagado ? "marcado PAGADO" : "marcado PENDIENTE")
      : `editado (${Object.keys(patch).filter((k) => k !== "updated_at").join(", ")})`;
    await registrarActividad(sb, {
      tipo: "pago_musico_editado",
      titulo: `${quien} ${que} el pago a músico ${upd?.musico ? `(${upd.musico}) ` : ""}en ${folio}`,
      actor, entidad: "musico", entidad_id: ventaId, entidad_nombre: folio,
      meta: patch,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, costo_extra: total, movido });
}

/** Suma un anticipo a un pago pendiente. Si con él se completa, queda pagado. */
async function registrarAbono(actor: string, id: string, crudo: unknown): Promise<NextResponse> {
  const abono = abonoDe(crudo as Record<string, unknown>);
  if (!abono) return NextResponse.json({ error: "Pon cuánto se le dio." }, { status: 400 });
  if (!abono.medio_pago) return NextResponse.json({ error: "Elige cómo se le pagó." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: prev, error: errLeer } = await sb.from("pagos_musico")
    .select("venta_id, musico, monto, pagado, abonos").eq("id", id).maybeSingle();
  if (errLeer) {
    return faltaColumnaAbonos(errLeer.message)
      ? NextResponse.json({ error: FALTA_SQL }, { status: 503 })
      : NextResponse.json({ error: errLeer.message }, { status: 500 });
  }
  if (!prev) return NextResponse.json({ error: "Ese pago ya no existe." }, { status: 404 });
  if (prev.pagado) return NextResponse.json({ error: "Ese pago ya está liquidado." }, { status: 409 });

  const previos = limpiarAbonos(prev.abonos);
  const monto = Number(prev.monto) || 0;
  const debia = monto - totalAbonado(previos);
  if (abono.monto - debia > 0.01) {
    return NextResponse.json({ error: `Es más de lo que se le debe (${peso(debia)}).` }, { status: 400 });
  }
  const abonos = [...previos, abono];
  const resta = Math.max(0, debia - abono.monto);
  const liquidado = resta <= 0.01;
  const patch: Record<string, unknown> = { abonos, updated_at: new Date().toISOString() };
  if (liquidado) Object.assign(patch, { pagado: true, medio_pago: abono.medio_pago, fecha: abono.fecha });

  const { error } = await sb.from("pagos_musico").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    const folio = prev.venta_id ? await folioDeVenta(sb, prev.venta_id as string) : "venta";
    await registrarActividad(sb, {
      tipo: "pago_musico_editado",
      titulo: `${quien} dio ${peso(abono.monto)} a ${prev.musico || "un músico"} en ${folio} · ${
        liquidado ? "queda LIQUIDADO" : `resta ${peso(resta)}`}`,
      actor, entidad: "musico", entidad_id: (prev.venta_id as string) ?? null, entidad_nombre: folio,
      meta: { abono, liquidado, resta },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, liquidado, resta });
}

// ── DELETE : elimina un pago ──
export async function DELETE(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: row } = await sb.from("pagos_musico").select("venta_id, musico, monto").eq("id", id).single();
  const { error } = await sb.from("pagos_musico").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ventaId = row?.venta_id as string | undefined;
  const total = ventaId ? await recomputeCostoExtra(sb, ventaId) : 0;

  try {
    const quien = await nombreDeActor(sb, actor);
    const folio = ventaId ? await folioDeVenta(sb, ventaId) : "venta";
    await registrarActividad(sb, {
      tipo: "pago_musico_eliminado",
      titulo: `${quien} eliminó el pago a músico ${row?.musico ? `(${row.musico}) ` : ""}${row?.monto ? `de ${peso(row.monto)} ` : ""}en ${folio}`,
      actor, entidad: "musico", entidad_id: ventaId ?? null, entidad_nombre: folio,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, costo_extra: total });
}
