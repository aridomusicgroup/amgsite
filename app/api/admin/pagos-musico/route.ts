import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

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
  const { data, error } = await sb
    .from("pagos_musico")
    .select("id, venta_id, musico, monto, fecha, medio_pago, pagado, nota")
    .eq("venta_id", ventaId)
    .order("created_at", { ascending: true });
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
  const { error } = await sb.from("pagos_musico").insert({
    venta_id: ventaId,
    musico: (b.musico || "").trim() || null,
    monto,
    fecha: b.fecha || null,
    medio_pago: (b.medio_pago || "").trim() || null,
    pagado: b.pagado === undefined ? true : Boolean(b.pagado),
    nota: (b.nota || "").trim() || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total = await recomputeCostoExtra(sb, ventaId);

  try {
    const quien = await nombreDeActor(sb, actor);
    const folio = await folioDeVenta(sb, ventaId);
    await registrarActividad(sb, {
      tipo: "pago_musico_registrado",
      titulo: `${quien} registró un pago a músico ${b.musico ? `(${b.musico}) ` : ""}de ${peso(monto)} en ${folio}${b.pagado === false ? " · PENDIENTE" : ""}`,
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

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("musico" in b) patch.musico = b.musico ? String(b.musico).trim() : null;
  if (b.monto !== undefined && b.monto !== "") patch.monto = Number(b.monto) || 0;
  if ("fecha" in b) patch.fecha = b.fecha || null;
  if ("medio_pago" in b) patch.medio_pago = b.medio_pago ? String(b.medio_pago).trim() : null;
  if ("pagado" in b) patch.pagado = Boolean(b.pagado);
  if ("nota" in b) patch.nota = b.nota ? String(b.nota).trim() : null;

  const sb = supabaseAdmin();
  const { data: upd, error } = await sb.from("pagos_musico").update(patch).eq("id", id).select("venta_id, musico").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ventaId = upd?.venta_id as string;
  const total = ventaId ? await recomputeCostoExtra(sb, ventaId) : 0;

  try {
    const quien = await nombreDeActor(sb, actor);
    const folio = ventaId ? await folioDeVenta(sb, ventaId) : "venta";
    const que = "pagado" in patch ? (patch.pagado ? "marcado PAGADO" : "marcado PENDIENTE") : `editado (${Object.keys(patch).filter((k) => k !== "updated_at").join(", ")})`;
    await registrarActividad(sb, {
      tipo: "pago_musico_editado",
      titulo: `${quien} ${que} el pago a músico ${upd?.musico ? `(${upd.musico}) ` : ""}en ${folio}`,
      actor, entidad: "musico", entidad_id: ventaId, entidad_nombre: folio,
      meta: patch,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, costo_extra: total });
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
