import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";
import { sincronizarFidelidadVenta } from "@/lib/fidelidad-server";

export const dynamic = "force-dynamic";

const peso = (n: unknown) => `$${(Number(n) || 0).toLocaleString("es-MX")}`;

const TIPOS = ["anticipo", "finiquito", "abono", "completo"];

/** Etiqueta el pago según lo que quedaba por cobrar antes de él. */
const etiqueta = (monto: number, saldoAntes: number): string =>
  monto >= saldoAntes - 0.5 ? "finiquito" : "abono";

/**
 * Los pagos que YA tenía la venta, sin contar uno (el que se está editando).
 * eslint-disable-next-line @typescript-eslint/no-explicit-any
 */
async function cobradoSin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  ventaId: string,
  excluirId?: string,
): Promise<number> {
  const { data } = await sb.from("pagos").select("id, monto_mxn").eq("venta_id", ventaId);
  return (data ?? [])
    .filter((p: { id: string }) => p.id !== excluirId)
    .reduce((a: number, p: { monto_mxn: number }) => a + (Number(p.monto_mxn) || 0), 0);
}

// ── Los pagos de una venta ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const ventaId = new URL(req.url).searchParams.get("venta_id");
  if (!ventaId) return NextResponse.json({ error: "Falta la venta." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("pagos")
    .select("id, fecha, monto_mxn, tipo, medio_pago, notas")
    .eq("venta_id", ventaId)
    .order("fecha", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: v } = await sb.from("ventas").select("total_mxn").eq("id", ventaId).single();
  const total = Number(v?.total_mxn) || 0;
  const cobrado = (data ?? []).reduce((a, p) => a + (Number(p.monto_mxn) || 0), 0);

  return NextResponse.json({
    pagos: data ?? [],
    total,
    cobrado,
    saldo: Math.max(0, total - cobrado),
  });
}

// Registra un pago (finiquito / abono / anticipo) sobre una venta ya existente.
// El ingreso se reconoce en la fecha del pago (base efectivo).
export async function POST(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const ventaId = String(b.venta_id || "").trim();
  const monto = Number(b.monto_mxn);
  if (!ventaId || !(monto > 0) || !b.fecha) {
    return NextResponse.json({ error: "Faltan datos (venta, monto o fecha)." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Valida la venta y calcula el saldo restante con lo ya cobrado.
  const { data: venta, error: vErr } = await sb
    .from("ventas").select("id, total_mxn").eq("id", ventaId).single();
  if (vErr || !venta) return NextResponse.json({ error: "Venta no encontrada." }, { status: 404 });

  const { data: prev } = await sb.from("pagos").select("monto_mxn").eq("venta_id", ventaId);
  const cobradoPrev = (prev ?? []).reduce((a, p) => a + (Number(p.monto_mxn) || 0), 0);
  const total = Number(venta.total_mxn) || 0;
  const saldoAntes = Math.max(0, total - cobradoPrev);

  const tipo = ["anticipo", "finiquito", "abono", "completo"].includes(b.tipo)
    ? b.tipo
    : monto >= saldoAntes - 0.5
      ? "finiquito"
      : "abono";

  const { error } = await sb.from("pagos").insert({
    venta_id: ventaId,
    fecha: b.fecha,
    monto_mxn: monto,
    tipo,
    medio_pago: b.medio_pago || null,
    notas: b.notas || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const saldo = Math.max(0, saldoAntes - monto);
  await sincronizarFidelidadVenta(sb, ventaId);

  try {
    const quien = await nombreDeActor(sb, actor);
    const { data: v } = await sb.from("ventas").select("folio, beat_nombre").eq("id", ventaId).single();
    await registrarActividad(sb, {
      tipo: "pago_registrado",
      titulo: `${quien} registró un ${tipo} de ${peso(monto)} en ${v?.folio ?? "la venta"}${v?.beat_nombre ? ` — ${v.beat_nombre}` : ""}${saldo <= 0.5 ? " (liquidada)" : ` · saldo ${peso(saldo)}`}`,
      actor, entidad: "pago", entidad_id: ventaId, entidad_nombre: (v?.folio as string) ?? null,
      meta: { monto_mxn: monto, tipo, saldo, medio_pago: b.medio_pago ?? null },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, saldo, liquidada: saldo <= 0.5 });
}

// ── Corregir un pago mal capturado ────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el pago." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: pago } = await sb
    .from("pagos")
    .select("id, venta_id, monto_mxn, fecha, medio_pago, notas")
    .eq("id", id)
    .single();
  if (!pago) return NextResponse.json({ error: "Ese pago ya no existe." }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (b.fecha) patch.fecha = String(b.fecha).slice(0, 10);
  for (const k of ["medio_pago", "notas"]) {
    if (k in b) patch[k] = b[k] ? String(b[k]).trim() : null;
  }

  const montoNuevo = b.monto_mxn !== undefined ? Number(b.monto_mxn) : Number(pago.monto_mxn);
  if (b.monto_mxn !== undefined) {
    if (!(montoNuevo > 0)) return NextResponse.json({ error: "El monto debe ser mayor a cero." }, { status: 400 });
    patch.monto_mxn = montoNuevo;
  }

  // La etiqueta se recalcula sola con el monto nuevo: un pago que era "abono" y
  // ahora cubre todo pasa a "finiquito". Dejarla congelada haría que el
  // historial contara una cosa distinta a los números.
  const ventaId = pago.venta_id as string;
  const { data: v } = await sb.from("ventas").select("total_mxn, folio").eq("id", ventaId).single();
  const total = Number(v?.total_mxn) || 0;
  const otros = await cobradoSin(sb, ventaId, id);
  patch.tipo = TIPOS.includes(b.tipo) ? b.tipo : etiqueta(montoNuevo, Math.max(0, total - otros));

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  const { error } = await sb.from("pagos").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const saldo = Math.max(0, total - (otros + montoNuevo));
  await sincronizarFidelidadVenta(sb, ventaId);

  try {
    const quien = await nombreDeActor(sb, actor);
    const antes = Number(pago.monto_mxn) || 0;
    const cambioMonto = Math.abs(antes - montoNuevo) > 0.5;
    await registrarActividad(sb, {
      tipo: "pago_editado",
      titulo:
        `${quien} corrigió un pago de ${v?.folio ?? "una venta"}` +
        (cambioMonto ? `: ${peso(antes)} → ${peso(montoNuevo)}` : "") +
        (saldo <= 0.5 ? " (liquidada)" : ` · saldo ${peso(saldo)}`),
      actor, entidad: "pago", entidad_id: ventaId, entidad_nombre: (v?.folio as string) ?? null,
      meta: { pago_id: id, antes, ahora: montoNuevo, saldo, cambios: Object.keys(patch) },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, saldo, liquidada: saldo <= 0.5 });
}

// ── Borrar un pago capturado por error ────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el pago." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: pago } = await sb.from("pagos").select("id, venta_id, monto_mxn").eq("id", id).single();
  if (!pago) return NextResponse.json({ error: "Ese pago ya no existe." }, { status: 404 });

  const ventaId = pago.venta_id as string;
  const { data: v } = await sb.from("ventas").select("total_mxn, folio").eq("id", ventaId).single();

  const { error } = await sb.from("pagos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const otros = await cobradoSin(sb, ventaId);
  const total = Number(v?.total_mxn) || 0;
  await sincronizarFidelidadVenta(sb, ventaId);

  // OJO: una venta SIN NINGÚN pago se considera cobrada al 100% (así se
  // capturaron las históricas y las de cobro instantáneo). Por eso borrar el
  // último pago no deja la venta "sin cobrar" sino "liquidada" — al revés de lo
  // que uno esperaría. Se avisa para que nadie lo descubra por accidente.
  const sinPagos = otros === 0;

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "pago_eliminado",
      titulo:
        `${quien} eliminó un pago de ${peso(pago.monto_mxn)} en ${v?.folio ?? "una venta"}` +
        (sinPagos ? " (era el único: la venta vuelve a contar como cobrada al 100%)" : ` · saldo ${peso(Math.max(0, total - otros))}`),
      actor, entidad: "pago", entidad_id: ventaId, entidad_nombre: (v?.folio as string) ?? null,
      meta: { monto_mxn: pago.monto_mxn, sinPagos },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, saldo: Math.max(0, total - otros), sinPagos });
}
