/**
 * A qué FAMILIA de acuerdo pertenece cada servicio.
 *
 * Un solo acuerdo no sirve para todo: al que compra una licencia de $834 ya
 * entregada no se le puede pedir que firme un anticipo del 50%, y un EP de tres
 * meses no se cobra igual que un beat suelto. Cada familia tiene su texto.
 *
 * Módulo PURO: sin base de datos, para poder probarlo solo.
 */

export type Familia = "licencia" | "exclusiva" | "personalizado" | "servicio" | "ep_album";

export const FAMILIAS: Familia[] = ["licencia", "exclusiva", "personalizado", "servicio", "ep_album"];

export const FAMILIA_LABEL: Record<Familia, string> = {
  licencia: "Licencia de beat de catálogo",
  exclusiva: "Cesión de exclusividad",
  personalizado: "Beat personalizado",
  servicio: "Grabación, mezcla y master",
  ep_album: "EP o álbum",
};

/**
 * Las que se firman DENTRO del panel.
 *
 * `licencia` y `exclusiva` quedan fuera a propósito: se aceptan en el checkout,
 * antes de pagar, y su entrega es inmediata. Pedírselas otra vez al entrar al
 * panel era justo el error que teníamos en vivo.
 */
export const FAMILIAS_PANEL: Familia[] = ["personalizado", "servicio", "ep_album"];

/**
 * Tipo de contrato de una cotización (`cotizaciones.tipo`) → familia.
 *
 * Sirve para decidir, al ENVIAR una cotización, si hace falta mandar el
 * enlace de firma antes del anticipo. `generico` no mapea a ninguna familia a
 * propósito: es el catch-all de trabajos que no encajan en las demás, y no
 * hay texto legal genérico razonable que ofrecerle. Esos casos los sigue
 * cubriendo el filtro del panel (`familiasDeCliente`) una vez que exista la
 * venta o el proyecto.
 */
const POR_COTIZACION: Partial<Record<string, Familia>> = {
  beat_personalizado: "personalizado",
  exclusiva: "exclusiva",
  servicio: "servicio",
  // "produccion" en ContractTipo es el cajón de grabación/mezcla/producción a
  // la medida sin catálogo — mismas cláusulas que "servicio".
  produccion: "servicio",
  ep_album: "ep_album",
};

export const familiaDeCotizacion = (tipo: string | null | undefined): Familia | null =>
  POR_COTIZACION[String(tipo || "").trim().toLowerCase()] ?? null;

/**
 * Tipos de proyecto (tabla `proyectos`) → familia.
 *
 * El picker de "Crear producción" (`ProduccionBoard.tsx`) usa "ep" y "album"
 * como tipos SEPARADOS (cada uno con su propia lista de canciones) — nunca
 * existe un proyecto con tipo literal "ep_album". Sin las dos claves, todo
 * proyecto de EP o álbum real quedaba invisible para el gate del panel.
 */
const POR_PROYECTO: Record<string, Familia> = {
  beat_personalizado: "personalizado",
  bp_letra: "personalizado",
  grabacion: "servicio",
  mezcla_master: "servicio",
  exclusividad: "exclusiva",
  ep: "ep_album",
  album: "ep_album",
};

export const familiaDeProyecto = (tipo: string | null | undefined): Familia | null =>
  POR_PROYECTO[String(tipo || "").trim().toLowerCase()] ?? null;

const norm = (s: string): string =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Tipos de venta (columna `ventas.tipo`) → familia.
 *
 * Aquí el texto es libre y capturado a mano ("Solo grabación", "BP + LETRA",
 * "EP"), así que se reconoce por patrón y no por una lista cerrada: una venta
 * escrita distinto no puede quedar fuera de su acuerdo.
 */
export function familiaDeVenta(tipo: string | null | undefined): Familia | null {
  const t = norm(tipo ?? "");
  if (!t) return null;
  if (/licencia/.test(t)) return "licencia";
  if (/exclusiv/.test(t)) return "exclusiva";
  if (/\bep\b|album/.test(t)) return "ep_album";
  if (/personalizado|bp\s*\+?\s*letra|beat\s*\+/.test(t)) return "personalizado";
  if (/grabaci|mezcla|master/.test(t)) return "servicio";
  return null;
}

/** De un montón de proyectos y ventas, qué familias del PANEL le tocan a alguien. */
export function familiasDeCliente(
  proyectos: Array<{ tipo?: string | null }>,
  ventas: Array<{ tipo?: string | null }>,
): Familia[] {
  const set = new Set<Familia>();
  for (const p of proyectos) {
    const f = familiaDeProyecto(p.tipo);
    if (f) set.add(f);
  }
  for (const v of ventas) {
    const f = familiaDeVenta(v.tipo);
    if (f) set.add(f);
  }
  return FAMILIAS_PANEL.filter((f) => set.has(f));
}

/** Lo que le falta firmar: lo que le toca, menos lo que ya aceptó. */
export function pendientes(suyas: Familia[], aceptadas: Familia[]): Familia[] {
  const ya = new Set(aceptadas);
  return suyas.filter((f) => !ya.has(f));
}
