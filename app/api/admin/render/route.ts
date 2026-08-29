import { NextRequest, NextResponse } from "next/server";
import { getDevEmail } from "@/lib/supabase/auth-server";
import { encolarRender, TIPOS_RENDER, type TipoRender } from "@/lib/render-jobs";

export const dynamic = "force-dynamic";

/** Encola un render de REAPER. Solo el desarrollador — dispara trabajo en su máquina. */
export async function POST(req: NextRequest) {
  const email = await getDevEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyectoId || "").trim();
  const tareaId = b.tareaId ? String(b.tareaId).trim() : null;
  const tipo = String(b.tipo || "") as TipoRender;

  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });
  if (!TIPOS_RENDER.includes(tipo)) return NextResponse.json({ error: "Tipo de render inválido." }, { status: 400 });

  const r = await encolarRender(proyectoId, tareaId, tipo, email);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ ok: true, id: r.id });
}
