import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

const peso = (n: unknown) => `$${(Number(n) || 0).toLocaleString("es-MX")}`;

// ── Dar de alta un pago recurrente (solo admin total) ──
export async function POST(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const nombre = String(b.nombre || "").trim();
  const diaMes = Number(b.dia_mes);
  if (!nombre || !(diaMes >= 1 && diaMes <= 31)) {
    return NextResponse.json({ error: "Faltan datos (nombre o día del mes 1-31)." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("gastos_recurrentes")
    .insert({
      nombre,
      categoria: b.categoria || null,
      proveedor: b.proveedor || null,
      monto_estimado: Number(b.monto_estimado) || 0,
      dia_mes: diaMes,
      notas: b.notas || null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "gasto_recurrente_creado",
      titulo: `${quien} agregó el pago recurrente "${nombre}" (${peso(b.monto_estimado)}, día ${diaMes})`,
      actor, entidad: "gasto_recurrente", entidad_id: data?.id ?? null, entidad_nombre: nombre,
      meta: { monto_estimado: Number(b.monto_estimado) || 0, dia_mes: diaMes },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, id: data?.id });
}

// ── Editar / pausar (solo admin total) ──
export async function PATCH(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (b.nombre !== undefined) patch.nombre = String(b.nombre).trim();
  for (const k of ["categoria", "proveedor", "notas"]) if (k in b) patch[k] = b[k] ? b[k] : null;
  if (b.monto_estimado !== undefined) patch.monto_estimado = Number(b.monto_estimado) || 0;
  if (b.dia_mes !== undefined) {
    const d = Number(b.dia_mes);
    if (!(d >= 1 && d <= 31)) return NextResponse.json({ error: "Día del mes inválido." }, { status: 400 });
    patch.dia_mes = d;
  }
  if ("activo" in b) patch.activo = Boolean(b.activo);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const sb = supabaseAdmin();
  const { data: prev } = await sb.from("gastos_recurrentes").select("nombre, activo").eq("id", id).single();
  const { error } = await sb.from("gastos_recurrentes").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    const nombreActual = (patch.nombre as string) || (prev?.nombre as string) || "pago recurrente";
    const cambioActivo = "activo" in patch && patch.activo !== prev?.activo;
    const titulo = cambioActivo
      ? `${quien} ${patch.activo ? "reactivó" : "pausó"} "${nombreActual}"`
      : `${quien} editó el pago recurrente "${nombreActual}"`;
    await registrarActividad(sb, {
      tipo: "gasto_recurrente_editado",
      titulo, actor, entidad: "gasto_recurrente", entidad_id: id, entidad_nombre: nombreActual,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}

// ── Eliminar (solo admin total) ──
export async function DELETE(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: g } = await sb.from("gastos_recurrentes").select("nombre").eq("id", id).single();
  const { error } = await sb.from("gastos_recurrentes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "gasto_recurrente_eliminado",
      titulo: `${quien} eliminó el pago recurrente "${(g?.nombre as string) ?? ""}"`,
      actor, entidad: "gasto_recurrente", entidad_id: id, entidad_nombre: (g?.nombre as string) ?? null,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}
