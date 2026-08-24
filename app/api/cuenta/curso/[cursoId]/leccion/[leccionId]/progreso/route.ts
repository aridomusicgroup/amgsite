import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { clienteTieneCurso, leccionParaStream, marcarProgreso } from "@/lib/cursos-cliente";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string; leccionId: string }> };

/** Marca una lección como vista (o no) para el cliente en sesión. */
export async function POST(req: NextRequest, { params }: Props) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { cursoId, leccionId } = await params;
  const leccion = await leccionParaStream(leccionId);
  if (!leccion || leccion.cursoId !== cursoId) return NextResponse.json({ error: "Lección no encontrada." }, { status: 404 });
  if (!(await clienteTieneCurso(email, cursoId))) return NextResponse.json({ error: "No tienes acceso a este curso." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  await marcarProgreso(email, leccionId, b.visto !== false);
  return NextResponse.json({ ok: true });
}
