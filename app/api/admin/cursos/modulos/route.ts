import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ── Agregar un módulo a un curso ──
export async function POST(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const cursoId = String(b.curso_id || "").trim();
  const titulo = String(b.titulo || "").trim();
  if (!cursoId || !titulo) return NextResponse.json({ error: "Faltan datos (curso o título)." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: ult } = await sb.from("curso_modulos").select("orden").eq("curso_id", cursoId).order("orden", { ascending: false }).limit(1);
  const orden = (Number(ult?.[0]?.orden) || 0) + 1;

  const { data, error } = await sb.from("curso_modulos").insert({ curso_id: cursoId, titulo, orden }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}

// ── Editar título / reordenar módulos ──
export async function PATCH(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  if (Array.isArray(b.orden_ids)) {
    const ids = b.orden_ids.filter((x: unknown): x is string => typeof x === "string");
    if (!ids.length) return NextResponse.json({ error: "Orden inválido." }, { status: 400 });
    await Promise.all(ids.map((id: string, i: number) => sb.from("curso_modulos").update({ orden: i }).eq("id", id)));
    return NextResponse.json({ ok: true });
  }

  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del módulo." }, { status: 400 });
  if (!b.titulo || !String(b.titulo).trim()) return NextResponse.json({ error: "Falta el título." }, { status: 400 });

  const { error } = await sb.from("curso_modulos").update({ titulo: String(b.titulo).trim() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Borrar un módulo (en cascada: sus lecciones) ──
export async function DELETE(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del módulo." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("curso_modulos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
