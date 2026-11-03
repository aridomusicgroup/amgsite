/**
 * Las voces que el cliente sube desde su pedido para que las mezclemos — lógica PURA.
 *
 * Antes se le pedía subirlas a Drive y alguien del estudio las bajaba y las
 * arrastraba a REAPER a mano. Ahora la caja "Tus voces" de /cuenta/pedido/<id>
 * las sube a la misma carpeta de Drive del proyecto, las anota en
 * `voces_cliente`, y el script del estudio (reaper-sync/voces.js) las baja y
 * las mete en la carpeta VOX GRP de su sesión, una por canal: la primera en
 * LEAD, luego PC LEAD, SEGUNDA y REFUERZO, y de ahí en adelante un canal nuevo.
 *
 * Sin imports a propósito: lo prueba `lib/voces-cliente.test.mjs` con `node --test`.
 */

/**
 * Producciones donde mezclamos las voces del cliente. Todos los paquetes del
 * catálogo traen "Mezcla y master"; la grabación suelta no ("sin mezcla"), así
 * que ahí la caja no sale.
 */
export const TIPOS_CON_VOCES = [
  "beat_personalizado",
  "bp_letra",
  "exclusividad",
  "mezcla_master",
  "mezcla_voces",
  "ep",
  "album",
] as const;

/** Tope por proyecto: una canción lleva 4-12 pistas de voz; más que esto es un error o abuso. */
export const MAX_VOCES_POR_PROYECTO = 60;

/** ¿Este proyecto recibe voces por la caja? */
export function aceptaVoces(tipo: string | null | undefined): boolean {
  return (TIPOS_CON_VOCES as readonly string[]).includes(String(tipo ?? ""));
}

/**
 * ¿Hay que decir de qué canción es? En un EP o álbum cada canción es su propia
 * sesión de REAPER: sin el tema, la voz no tendría a qué proyecto entrar.
 */
export function pideTema(tipo: string | null | undefined): boolean {
  return tipo === "ep" || tipo === "album";
}

/**
 * Sólo WAV. REAPER necesita la duración para que el clip se vea y se oiga, y el
 * script la lee de la cabecera del WAV (igual que las pistas de los músicos).
 * Un MP3 de voz además pierde calidad: para mezclar no sirve.
 */
export function esWav(nombre: string | null | undefined): boolean {
  return /\.wav$/i.test(String(nombre ?? "").trim());
}

/** Lo que ve el cliente de cada voz. */
export type EstadoVoz = "recibida" | "en_sesion";

/**
 * "Recibida" hasta que entra al proyecto, "en tu sesión" cuando ya está en
 * VOX GRP. Un error del lado del estudio no se le muestra: para él la voz llegó
 * bien, y quien la tiene que arreglar es el estudio (lo ve en la Consola).
 */
export function estadoVoz(v: { importado_at: string | null }): EstadoVoz {
  return v.importado_at ? "en_sesion" : "recibida";
}
