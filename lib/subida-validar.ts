/**
 * Reglas de las subidas a Drive que abre el servidor — lógica PURA.
 *
 * El navegador ya no recibe un token de Drive: pide una sesión resumible para
 * UN archivo (`/api/cuenta/pedido/<id>/subida`, `/api/musico/asignacion/<id>/subida`)
 * y el servidor decide nombre, tipo, tamaño y carpeta. Esto es lo que valida
 * lo que manda el navegador antes de abrirle la sesión.
 *
 * Sin imports a propósito: lo prueba `lib/subida-validar.test.mjs` con `node --test`.
 */

/** Nombre más largo que se acepta (Drive aguanta más; nadie lo necesita). */
export const MAX_NOMBRE_SUBIDA = 200;

/** Lo más que pesa un archivo del cliente o del músico: una sesión de varias pistas largas cabe de sobra. */
export const MAX_BYTES_SUBIDA = 5 * 1024 * 1024 * 1024;

/**
 * El nombre tal como lo eligió quien sube, sin ruta ni caracteres de control.
 * No se le quitan acentos ni signos: así se ve en Drive igual que antes.
 */
export function nombreDeSubida(nombre: unknown): string {
  return String(nombre ?? "")
    .replace(/^.*[\\/]/, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_NOMBRE_SUBIDA);
}

const POR_EXTENSION: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aif: "audio/aiff",
  aiff: "audio/aiff",
  flac: "audio/flac",
  zip: "application/zip",
  pdf: "application/pdf",
  txt: "text/plain",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

/**
 * El tipo que se declara a Google. El del navegador si tiene forma de tipo
 * MIME; si no (Windows a veces manda "" para un .wav), el de la extensión.
 */
export function mimeDeSubida(mime: unknown, nombre: string): string {
  const m = String(mime ?? "").trim().toLowerCase();
  if (m.length <= 100 && /^[a-z]+\/[a-z0-9.+-]+$/.test(m)) return m;
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  return POR_EXTENSION[ext] ?? "application/octet-stream";
}

/** Tamaño entero, mayor que cero y bajo el tope. null si no sirve. */
export function bytesDeSubida(bytes: unknown, max = MAX_BYTES_SUBIDA): number | null {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return null;
  const b = Math.floor(n);
  return b > 0 && b <= max ? b : null;
}

/** ¿Cabe en el espacio del proyecto? Sin límite (0) siempre cabe. */
export function cabeEnEspacio(usadoBytes: number, limiteBytes: number, bytes: number): boolean {
  if (!(limiteBytes > 0)) return true;
  return usadoBytes + bytes <= limiteBytes;
}

/**
 * La etiqueta del canal que el músico pone en el nombre ("L", "Pista 2"). Va
 * dentro del nombre en Drive, así que sin caracteres raros y corta.
 */
export function etiquetaDeCanal(etiqueta: unknown): string {
  return String(etiqueta ?? "").replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "").trim().slice(0, 30);
}
