import { NextRequest, NextResponse } from "next/server";
import { descargarArchivo } from "@/lib/drive-api";
import { respuestaDeDrive } from "@/lib/curso-proxy";
import { alumnoDeLeccion } from "@/lib/curso-guard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cursoId: string; leccionId: string; n: string }> };

/**
 * Un recurso de la lección (PDF, pista de acompañamiento, Guitar Pro…) por su
 * posición en la lista: el navegador nunca ve el ID de Drive. `?descargar=1`
 * lo baja como archivo; sin eso se reproduce/abre en línea (audio de quiz).
 */
export async function GET(req: NextRequest, { params }: Props) {
  const { cursoId, leccionId, n } = await params;
  const g = await alumnoDeLeccion(cursoId, leccionId);
  if (!g.ok) return g.res;

  const idx = Number(n);
  const recurso = Number.isInteger(idx) ? g.leccion.recursos[idx] : undefined;
  if (!recurso) return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });

  const descargar = req.nextUrl.searchParams.get("descargar") === "1";
  return respuestaDeDrive(
    await descargarArchivo(recurso.drive_file_id, req.headers.get("range")),
    descargar ? { descarga: recurso.titulo } : undefined,
  );
}
