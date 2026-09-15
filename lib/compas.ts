// El compás de una canción ("6/8"). Módulo puro: lo usan el panel y las rutas.
//
// Va junto al BPM porque en REAPER son la misma línea (`TEMPO 154 6 8`): el
// script del estudio pone los dos en el .rpp mientras nadie lo haya guardado.

/** Los que se usan en el estudio, del más común al menos. */
export const COMPASES = ["4/4", "3/4", "6/8", "12/8", "2/4", "6/4", "5/4", "7/8"];

const DENOMINADORES = [1, 2, 4, 8, 16, 32];

/** "6 / 8" → "6/8". null si no es un compás válido (o vino vacío). */
export function limpiarCompas(v: unknown): string | null {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(String(v ?? ""));
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (num < 1 || !DENOMINADORES.includes(den)) return null;
  return `${num}/${den}`;
}
