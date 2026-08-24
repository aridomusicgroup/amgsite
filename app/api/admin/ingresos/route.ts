import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nextFolio } from "@/lib/folio";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

const peso = (n: unknown) => `$${(Number(n) || 0).toLocaleString("es-MX")}`;

// Registra un "otro ingreso" (YouTube, streaming, payout…). Solo admin total.
export async function POST(req: NextRequest) {
  const email = await getFullAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const total = Number(b.monto_mxn);
  if (!b.fecha || !(total > 0)) {
    return NextResponse.json({ error: "Faltan datos (fecha o monto en MXN)." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const folio = await nextFolio(sb, "ingresos", "OI");

  const { error } = await sb.from("ingresos").insert({
    folio,
    fecha: b.fecha,
    fuente: (b.fuente || "").trim() || null,
    concepto: (b.concepto || "").trim() || null,
    moneda: String(b.moneda || "MXN").toUpperCase().slice(0, 4),
    monto_mxn: total,
    recurrente: Boolean(b.recurrente),
    nota: (b.nota || "").trim() || null,
    creado_por: email,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, email);
    await registrarActividad(sb, {
      tipo: "ingreso_creado",
      titulo: `${quien} registró el ingreso ${folio} — ${b.fuente || b.concepto || "otro ingreso"} · ${peso(total)}`,
      actor: email, entidad: "ingreso", entidad_nombre: folio,
      meta: { monto_mxn: total, fuente: b.fuente ?? null, recurrente: Boolean(b.recurrente) },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, folio });
}

// ── Editar (solo admin total) ──
export async function PATCH(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del ingreso." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.fecha) patch.fecha = b.fecha;
  for (const k of ["fuente", "concepto", "nota"]) if (k in b) patch[k] = b[k] ? String(b[k]).trim() : null;
  if ("moneda" in b) patch.moneda = String(b.moneda || "MXN").toUpperCase().slice(0, 4);
  if ("recurrente" in b) patch.recurrente = Boolean(b.recurrente);
  if (b.monto_mxn !== undefined && b.monto_mxn !== "") patch.monto_mxn = Number(b.monto_mxn) || 0;
  if (Object.keys(patch).length === 1) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("ingresos").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Eliminar (solo admin total) ──
export async function DELETE(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del ingreso." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: ing } = await sb.from("ingresos").select("folio, monto_mxn").eq("id", id).single();
  const { error } = await sb.from("ingresos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "ingreso_eliminado",
      titulo: `${quien} eliminó el ingreso ${ing?.folio ?? ""}${ing?.monto_mxn ? ` · ${peso(ing.monto_mxn)}` : ""}`,
      actor, entidad: "ingreso", entidad_id: id, entidad_nombre: (ing?.folio as string) ?? null,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}
