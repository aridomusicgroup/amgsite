import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TIPOS_CON_SUBIDA } from "@/lib/almacenamiento";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

// ── Editar el límite default (MB) de un tipo de producción (solo admin total) ──
export async function PATCH(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const tipo = String(b.tipo || "");
  const limiteMb = Number(b.limite_mb);
  if (!TIPOS_CON_SUBIDA.includes(tipo as (typeof TIPOS_CON_SUBIDA)[number])) {
    return NextResponse.json({ error: "Tipo no reconocido." }, { status: 400 });
  }
  if (!(limiteMb > 0)) return NextResponse.json({ error: "El límite debe ser mayor a 0." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("almacenamiento_tipos_default")
    .upsert({ tipo, limite_mb: limiteMb, updated_at: new Date().toISOString() }, { onConflict: "tipo" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "almacenamiento_tipo_editado",
      titulo: `${quien} cambió el límite de almacenamiento de "${tipo}" a ${limiteMb} MB`,
      actor,
      entidad: "almacenamiento",
      meta: { tipo, limite_mb: limiteMb },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}
