/**
 * La pregunta "¿mandas un previo al cliente?" que sale al palomear Mezclar o
 * Masterizar. Vive aparte del cálculo (que es server-only) porque la usan las
 * dos orillas: el servidor la arma y el navegador la pinta.
 *
 * Sin imports a propósito: lo prueba `lib/previo-cliente-tipos.test.mjs`.
 */

export type PasoDeMezcla = "Mezclar" | "Masterizar";

/**
 * "Mezclar" → "Mezclar"; "masterizar" → "Masterizar"; cualquier otra → null.
 * Acepta "Mezclar voces" (la mezcla de voces del cliente), pero no una tarea que
 * sólo contenga la palabra ("Pedir mezcla de referencia", "Mezclador").
 */
export function pasoDeMezcla(titulo: string | null | undefined): PasoDeMezcla | null {
  const m = /^\s*(mezclar|masterizar)(?:\s+voces)?\s*$/i.exec(String(titulo ?? ""));
  if (!m) return null;
  return m[1].toLowerCase() === "mezclar" ? "Mezclar" : "Masterizar";
}

export interface PreguntaPrevio {
  proyectoId: string;
  /** El tema, si es EP/álbum (cada canción es su propio .rpp). null = proyecto normal. */
  temaId: string | null;
  /** "EL NECIO", o "TRiP MX · LA KHABALAH" en un EP. */
  donde: string;
  /** Qué se acaba de palomear. */
  paso: PasoDeMezcla;
  /** El nombre del cliente, para que la pregunta diga a quién le llega. */
  cliente: string | null;
}

/** Evento con el que una palomita le pide al lanzador que pregunte. */
export const EVENTO_PREVIO_CLIENTE = "arido:previo-cliente";
