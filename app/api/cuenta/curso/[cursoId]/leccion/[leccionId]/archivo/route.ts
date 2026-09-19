import { NextRequest, NextResponse } from "next/server";
import { alumnoDeLeccion } from "@/lib/curso-guard";
import { descargarArchivo } from "@/lib/drive-api";
import { respuestaDeDrive } from "@/lib/curso-proxy";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string; leccionId: string }> };

/**
 * Sirve el video/PDF/tablatura de una lección SIN exponer nunca el link real
 * de Drive: cada request revalida sesión + lección publicada + acceso vigente
 * + curso ya lanzado (el mismo candado que el resto de las APIs del alumno)
 * antes de pedirle el byte a Google (cuenta de servicio, solo lectura). Pasa
 * el header `Range` tal cual para que el reproductor pueda adelantar/atrasar
 * sin bajar el archivo completo.
 */
export async function GET(req: NextRequest, { params }: Props) {
  const { cursoId, leccionId } = await params;
  const g = await alumnoDeLeccion(cursoId, leccionId);
  if (!g.ok) return g.res;
  if (!g.leccion.driveFileId) return NextResponse.json({ error: "Esta lección no tiene archivo todavía." }, { status: 404 });

  return respuestaDeDrive(await descargarArchivo(g.leccion.driveFileId, req.headers.get("range")));
}
