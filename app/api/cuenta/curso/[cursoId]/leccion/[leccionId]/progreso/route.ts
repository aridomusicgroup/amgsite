import { NextRequest, NextResponse } from "next/server";
import { guardarPosicion, marcarProgreso } from "@/lib/cursos-cliente";
import { alumnoDeLeccion } from "@/lib/curso-guard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string; leccionId: string }> };

/**
 * Progreso del alumno en una lección:
 *  - `{ visto: true|false }` la marca (o desmarca) como vista.
 *  - `{ segundos: n }` guarda dónde se quedó en el video, para retomar ahí.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const { cursoId, leccionId } = await params;
  const g = await alumnoDeLeccion(cursoId, leccionId);
  if (!g.ok) return g.res;

  const b = await req.json().catch(() => ({}));
  if (typeof b.segundos === "number" && Number.isFinite(b.segundos)) {
    await guardarPosicion(g.email, leccionId, b.segundos);
    return NextResponse.json({ ok: true });
  }
  // Un quiz sólo se marca visto al aprobarlo (ver /quiz), no a mano.
  if (g.leccion.tipo === "quiz") return NextResponse.json({ error: "El quiz se marca al aprobarlo." }, { status: 400 });
  await marcarProgreso(g.email, leccionId, b.visto !== false);
  return NextResponse.json({ ok: true });
}
