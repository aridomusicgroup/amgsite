import { NextRequest, NextResponse } from "next/server";
import { alumnoDeCurso } from "@/lib/curso-guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string }> };

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * “Anótame”: el alumno se suma a la lista de espera de la mentoría desde un
 * llamado. Una sola vez por correo (unique producto+email): dar clic dos veces
 * no infla la cuenta que se usa para decidir si lanzarla.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { cursoId } = await params;
  const g = await alumnoDeCurso(cursoId);
  if (!g.ok) return g.res;
  if (!rateLimit(`interes:${g.email}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos." }, { status: 429 });
  }
  const b = await req.json().catch(() => ({}));
  const leccionId = typeof b.leccion_id === "string" && UUID.test(b.leccion_id) ? b.leccion_id : null;

  const { error } = await supabaseAdmin().from("curso_interes").upsert(
    { producto: "mentoria", email: g.email.trim().toLowerCase(), curso_id: cursoId, leccion_id: leccionId },
    { onConflict: "producto,email", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
