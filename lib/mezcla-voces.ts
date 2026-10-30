/**
 * Mezcla de voces sobre un tema que ya produjimos — lógica PURA.
 *
 * El cliente termina su producción y, tiempo después, regresa por la mezcla de
 * sus voces. No es reabrir el proyecto entregado: es una venta nueva con su
 * proyecto propio, LIGADO al original (`proyecto_origen_id`, igual que el
 * diseño visual). Pero la mezcla se hace DENTRO de la misma sesión de REAPER, y
 * el script del estudio crea una carpeta con una plantilla para todo proyecto
 * nuevo. Aquí vive la regla de cuándo el proyecto nuevo hereda la carpeta del
 * original en vez de pedir una.
 *
 * Sin imports a propósito: lo prueba `lib/mezcla-voces.test.mjs` con `node --test`.
 */

/** `proyectos.tipo`. Lo leen el SQL de la plantilla, el motor de tareas y las etiquetas. */
export const TIPO_PROYECTO_MEZCLA_VOCES = "mezcla_voces";

/** `ventas.tipo`, el texto libre que ve el panel. */
export const TIPO_VENTA_MEZCLA_VOCES = "Mezcla de voces";

const normalizar = (s: string): string =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// "Mezcla de voces" / "Vocal mix" (catálogo, es/en), con o sin el tema pegado.
const ES_MEZCLA_VOCES = /\bmezcla de (voz|voces)\b|\bvocal mix\b/;

/**
 * ¿La cotización es SOLO mezcla de voces?
 *
 * Con otro concepto (mezcla y master, un instrumento) ya no lo es: el proyecto
 * necesita las tareas de lo demás y se queda como hoy.
 */
export function esMezclaDeVoces(items: readonly { label: string }[]): boolean {
  return items.length > 0 && items.every((i) => ES_MEZCLA_VOCES.test(normalizar(i.label)));
}

/**
 * ¿Esta carpeta de REAPER es de OTRO proyecto?
 *
 * Una mezcla de voces que heredó la sesión lleva anclada la carpeta del
 * original (`herenciaReaper`). Renombrarla en el panel NO debe ofrecer mover esa
 * carpeta: el script del estudio la movería y el proyecto entregado se
 * quedaría sin sesión.
 */
export function comparteSesionDelOriginal(p: { tipo: string | null; reaper_carpeta: string | null }): boolean {
  return p.tipo === TIPO_PROYECTO_MEZCLA_VOCES && !!p.reaper_carpeta;
}

/** Lo que hace falta saber del proyecto original para heredar su sesión. */
export interface OrigenReaper {
  tipo: string | null;
  titulo: string | null;
  /** El nombre de la carpeta ANCLADO, si lo renombraron en el panel. */
  reaper_carpeta: string | null;
  contacto_id: string | null;
}

export interface HerenciaReaper {
  /** El script del estudio solo crea carpetas de los proyectos con `reaper_creado = false`. */
  reaper_creado: true;
  reaper_carpeta: string;
}

/**
 * Qué heredar de la sesión de REAPER del original, o `null` si el proyecto
 * nuevo debe nacer como cualquier otro (con su carpeta y su plantilla).
 *
 * Hereda marcándose como ya creado y apuntando a la carpeta del original: así
 * el script no copia una plantilla, y los renders, el inventario y "Abrir en
 * REAPER" caen en la sesión de siempre — el nombre de los archivos sale del
 * título del proyecto nuevo, así que no pisan lo que ya se entregó.
 *
 * No hereda cuando:
 *  - no hay original;
 *  - el original es de otro cliente: la carpeta del cliente no coincide y
 *    apuntar ahí dejaría el proyecto sin sesión;
 *  - el original es un EP o álbum: el .rpp vive dentro de cada tema, no hay una
 *    carpeta única a la que apuntar.
 *
 * `nombreCarpeta` se recibe en vez de importarse: la copia que manda es la de
 * `lib/carpeta-reaper.ts` (server-only) y este módulo tiene que correr en el
 * navegador y en las pruebas.
 */
export function herenciaReaper(
  origen: OrigenReaper | null,
  contactoId: string | null,
  nombreCarpeta: (s: string) => string,
): HerenciaReaper | null {
  if (!origen || !contactoId || origen.contacto_id !== contactoId) return null;
  if (origen.tipo === "ep" || origen.tipo === "album") return null;
  const carpeta = origen.reaper_carpeta || nombreCarpeta(origen.titulo ?? "");
  return carpeta ? { reaper_creado: true, reaper_carpeta: carpeta } : null;
}
