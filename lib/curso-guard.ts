import "server-only";
import { NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { clienteTieneCurso, leccionParaStream, type LeccionStream } from "@/lib/cursos-cliente";

/**
 * La misma validación para todas las APIs del alumno sobre una lección:
 * sesión de cliente + lección publicada de ESE curso + acceso vigente.
 * Devuelve la respuesta de error lista, o el correo y la lección.
 */
export async function alumnoDeLeccion(
  cursoId: string,
  leccionId: string,
): Promise<{ ok: true; email: string; leccion: LeccionStream } | { ok: false; res: NextResponse }> {
  const email = await getCustomerEmail();
  if (!email) return { ok: false, res: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const leccion = await leccionParaStream(leccionId);
  if (!leccion || leccion.cursoId !== cursoId || !leccion.publicada) {
    return { ok: false, res: NextResponse.json({ error: "Lección no encontrada." }, { status: 404 }) };
  }
  if (!(await clienteTieneCurso(email, cursoId))) {
    return { ok: false, res: NextResponse.json({ error: "No tienes acceso a este curso." }, { status: 403 }) };
  }
  return { ok: true, email, leccion };
}

/** Sólo sesión + acceso vigente al curso (para lo que no es de una lección: bitácora, certificado). */
export async function alumnoDeCurso(cursoId: string): Promise<{ ok: true; email: string } | { ok: false; res: NextResponse }> {
  const email = await getCustomerEmail();
  if (!email) return { ok: false, res: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  if (!(await clienteTieneCurso(email, cursoId))) {
    return { ok: false, res: NextResponse.json({ error: "No tienes acceso a este curso." }, { status: 403 }) };
  }
  return { ok: true, email };
}
