import { NextRequest, NextResponse } from "next/server";
import { leccionGratis } from "@/lib/cursos-publico";
import { descargarArchivo } from "@/lib/drive-api";
import { respuestaDeDrive } from "@/lib/curso-proxy";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ leccionId: string }> };

/**
 * Video de una lección de VISTA PREVIA para la página de venta: sin sesión,
 * pero sólo si la lección está marcada como gratis, publicada y su curso a la
 * venta. Cualquier otra lección da 404, aunque se adivine su id.
 */
export async function GET(req: NextRequest, { params }: Props) {
  // Un video pide muchos rangos: el tope es generoso, sólo frena abusos.
  if (!rateLimit(`preview:${clientIp(req)}`, 600, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes." }, { status: 429 });
  }
  const { leccionId } = await params;
  const fileId = await leccionGratis(leccionId);
  if (!fileId) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return respuestaDeDrive(await descargarArchivo(fileId, req.headers.get("range")));
}
