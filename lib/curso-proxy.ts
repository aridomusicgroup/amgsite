import "server-only";
import { NextResponse } from "next/server";

const EXT_DE_TIPO: Record<string, string> = {
  "application/pdf": ".pdf",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
  "video/mp4": ".mp4",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

/**
 * Convierte la respuesta cruda de Google Drive en la respuesta del proxy de
 * Cursos: copia sólo los headers que el reproductor necesita (tipo, tamaño,
 * rango) y prohíbe el caché compartido — el archivo es de paga.
 */
export function respuestaDeDrive(upstream: Response | null, opciones?: { descarga?: string }): NextResponse {
  if (!upstream) return NextResponse.json({ error: "Archivos no disponibles todavía." }, { status: 503 });
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: "No se pudo leer el archivo (revisa que la carpeta esté compartida con la cuenta de servicio)." },
      { status: upstream.status === 404 ? 404 : 502 },
    );
  }
  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("cache-control", "private, no-store");
  if (opciones?.descarga) {
    let limpio = opciones.descarga.replace(/[\\/:*?"<>|\r\n]/g, "").slice(0, 120) || "archivo";
    const ext = EXT_DE_TIPO[(upstream.headers.get("content-type") ?? "").split(";")[0].trim()];
    if (ext && !/\.[a-z0-9]{2,5}$/i.test(limpio)) limpio += ext;
    headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(limpio)}`);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
