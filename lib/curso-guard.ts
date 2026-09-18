import "server-only";
import { NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { clienteTieneCurso, cursoEnPreventa, leccionParaStream, type LeccionStream } from "@/lib/cursos-cliente";

/** En preventa nadie entra al contenido (ni bitácora ni certificado) hasta el lanzamiento. */
async function cerradoPorPreventa(cursoId: string): Promise<NextResponse | null> {
  const p = await cursoEnPreventa(cursoId);
  if (!p) return null;
  const cuando = p.lanzamiento ? ` Lanzamiento: ${p.lanzamiento}.` : "";
  return NextResponse.json({ error: `El curso todavía está en preventa.${cuando}` }, { status: 403 });
}

/**
 * La misma validación para todas las APIs del alumno sobre una lección:
 * sesión de cliente + lección publicada de ESE curso + acceso vigente + curso
 * ya lanzado (en preventa el contenido está cerrado).
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
  const cerrado = await cerradoPorPreventa(cursoId);
  if (cerrado) return { ok: false, res: cerrado };
  return { ok: true, email, leccion };
}

/** Sesión + acceso vigente a un curso ya lanzado (para lo que no es de una lección: bitácora, certificado). */
export async function alumnoDeCurso(cursoId: string): Promise<{ ok: true; email: string } | { ok: false; res: NextResponse }> {
  const email = await getCustomerEmail();
  if (!email) return { ok: false, res: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  if (!(await clienteTieneCurso(email, cursoId))) {
    return { ok: false, res: NextResponse.json({ error: "No tienes acceso a este curso." }, { status: 403 }) };
  }
  const cerrado = await cerradoPorPreventa(cursoId);
  if (cerrado) return { ok: false, res: cerrado };
  return { ok: true, email };
}
