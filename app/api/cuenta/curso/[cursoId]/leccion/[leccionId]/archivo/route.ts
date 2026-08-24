import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { clienteTieneCurso, leccionParaStream } from "@/lib/cursos-cliente";
import { descargarArchivo } from "@/lib/drive-api";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string; leccionId: string }> };

/**
 * Sirve el video/PDF de una lección SIN exponer nunca el link real de Drive:
 * cada request revalida sesión + acceso pagado antes de pedirle el byte a
 * Google (cuenta de servicio, solo lectura — la misma que ya lee las
 * carpetas de beats). Pasa el header `Range` tal cual para que el
 * reproductor pueda adelantar/atrasar sin bajar el archivo completo.
 */
export async function GET(req: NextRequest, { params }: Props) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { cursoId, leccionId } = await params;
  const leccion = await leccionParaStream(leccionId);
  if (!leccion || leccion.cursoId !== cursoId) return NextResponse.json({ error: "Lección no encontrada." }, { status: 404 });
  if (!leccion.driveFileId) return NextResponse.json({ error: "Esta lección no tiene archivo todavía." }, { status: 404 });

  if (!(await clienteTieneCurso(email, cursoId))) return NextResponse.json({ error: "No tienes acceso a este curso." }, { status: 403 });

  const upstream = await descargarArchivo(leccion.driveFileId, req.headers.get("range"));
  if (!upstream) return NextResponse.json({ error: "Subida de archivos no disponible todavía." }, { status: 503 });
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "No se pudo leer el archivo (revisa que la carpeta esté compartida con la cuenta de servicio)." }, { status: upstream.status === 404 ? 404 : 502 });
  }

  const headers = new Headers();
  const pasar = ["content-type", "content-length", "content-range", "accept-ranges"];
  for (const h of pasar) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("cache-control", "private, no-store");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
