import { NextRequest, NextResponse } from "next/server";
import { alumnoDeCurso } from "@/lib/curso-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hoyMx } from "@/lib/cursos-tipos";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string }> };

/**
 * Bitácora de práctica: registra minutos de HOY (hora de México). Se puede
 * registrar varias veces al día; la racha y la semana se calculan al pintar.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { cursoId } = await params;
  const g = await alumnoDeCurso(cursoId);
  if (!g.ok) return g.res;
  if (!rateLimit(`practica:${g.email}`, 30, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiados registros. Intenta más tarde." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const minutos = Math.floor(Number(b.minutos));
  if (!(minutos >= 1 && minutos <= 600)) return NextResponse.json({ error: "Minutos de 1 a 600." }, { status: 400 });

  const { error } = await supabaseAdmin().from("curso_practica").insert({
    curso_id: cursoId,
    email: g.email.trim().toLowerCase(),
    fecha: hoyMx(),
    minutos,
    nota: b.nota ? String(b.nota).trim().slice(0, 300) : null,
  });
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
