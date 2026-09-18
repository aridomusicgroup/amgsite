import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { clienteTieneCurso, leccionParaStream } from "@/lib/cursos-cliente";
import { descargarArchivo } from "@/lib/drive-api";
import { respuestaDeDrive } from "@/lib/curso-proxy";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string; leccionId: string }> };

/**
 * Sirve el video/PDF/tablatura de una lección SIN exponer nunca el link real
 * de Drive: cada request revalida sesión + acceso vigente antes de pedirle el
 * byte a Google (cuenta de servicio, solo lectura — la misma que ya lee las
 * carpetas de beats). Pasa el header `Range` tal cual para que el reproductor
 * pueda adelantar/atrasar sin bajar el archivo completo.
 */
export async function GET(req: NextRequest, { params }: Props) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { cursoId, leccionId } = await params;
  const leccion = await leccionParaStream(leccionId);
  // Una lección sin publicar no se sirve aunque alguien adivine su id.
  if (!leccion || leccion.cursoId !== cursoId || !leccion.publicada) return NextResponse.json({ error: "Lección no encontrada." }, { status: 404 });
  if (!leccion.driveFileId) return NextResponse.json({ error: "Esta lección no tiene archivo todavía." }, { status: 404 });

  if (!(await clienteTieneCurso(email, cursoId))) return NextResponse.json({ error: "No tienes acceso a este curso." }, { status: 403 });

  return respuestaDeDrive(await descargarArchivo(leccion.driveFileId, req.headers.get("range")));
}
