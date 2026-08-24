/**
 * Tipos de producción donde el cliente sube archivos de verdad (audio crudo,
 * maquetas). El resto (contenido, distribución, admin…) son internos — no
 * tienen panel de cliente con subida, así que no necesitan default de cuota.
 */
export const TIPOS_CON_SUBIDA = [
  "beat_personalizado",
  "bp_letra",
  "exclusividad",
  "grabacion",
  "mezcla_master",
  "ep",
  "album",
] as const;

export const TIPO_ALMACENAMIENTO_LABEL: Record<string, string> = {
  beat_personalizado: "Beat personalizado",
  bp_letra: "BP + Letra",
  exclusividad: "Exclusividad",
  grabacion: "Grabación",
  mezcla_master: "Mezcla / Master",
  ep: "EP",
  album: "Álbum",
};

/** Mismos valores que la fila semilla del SQL — respaldo si la tabla de
 *  defaults aún no existe o a un tipo le falta su fila. */
export const DEFAULTS_MB_FALLBACK: Record<string, number> = {
  beat_personalizado: 300,
  bp_letra: 300,
  exclusividad: 500,
  grabacion: 3072,
  mezcla_master: 5120,
  ep: 8192,
  album: 15360,
};

const DEFAULT_GENERICO_MB = 1024; // tipo sin default configurado ni fallback conocido

/** El límite que de verdad aplica a un proyecto: su override si tiene, si no
 *  el default de su tipo, si no un genérico razonable. */
export function limiteEfectivoMb(
  tipo: string | null,
  overrideMb: number | null,
  defaults: Record<string, number>,
): number {
  if (overrideMb != null && overrideMb > 0) return overrideMb;
  if (tipo && defaults[tipo]) return defaults[tipo];
  if (tipo && DEFAULTS_MB_FALLBACK[tipo]) return DEFAULTS_MB_FALLBACK[tipo];
  return DEFAULT_GENERICO_MB;
}

export function formatoMb(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

export function formatoBytes(bytes: number): string {
  return formatoMb(bytes / (1024 * 1024));
}
