/**
 * Extrae el ID de un archivo de Drive de lo que sea que el admin pegue:
 * un link completo (varios formatos de Google) o ya el ID a secas.
 */
export function extraerDriveId(input: string): string | null {
  const v = input.trim();
  if (!v) return null;

  const patrones = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,   // .../file/d/ID/view
    /[?&]id=([a-zA-Z0-9_-]{10,})/,        // .../open?id=ID
    /\/d\/([a-zA-Z0-9_-]{10,})/,          // .../d/ID
  ];
  for (const re of patrones) {
    const m = v.match(re);
    if (m) return m[1];
  }
  // Ya viene como ID puro (sin espacios ni barras, largo típico de Drive).
  if (/^[a-zA-Z0-9_-]{10,}$/.test(v)) return v;
  return null;
}
