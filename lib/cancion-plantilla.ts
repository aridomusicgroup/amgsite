/**
 * Los pasos que nacen DENTRO de cada tema de un EP o álbum.
 *
 * Módulo puro, sin base de datos: lo importan el motor (servidor) y el editor
 * de Ajustes (navegador), para que la pantalla muestre exactamente lo que va a
 * pasar cuando todavía nadie ha guardado una plantilla propia.
 *
 * Vive como un pseudo-tipo de `tarea_plantillas` (el SQL ya prevé los que
 * empiezan con `_`): cada renglón es una SUBTAREA de cada tema, no una tarea
 * del proyecto. Así se edita en la misma pantalla que las demás plantillas, sin
 * tabla ni migración nuevas.
 */
export const TIPO_CANCION = "_cancion";

export const LABEL_CANCION = "Cada tema de EP / Álbum";

import type { PasoEntrega } from "@/lib/pasos-entrega";

export interface PasoCancion {
  clase: "tarea" | "instrumentos";
  titulo: string;
  /** Alias que entiende `resolverEquipo` (eliud|diego|luis|tozi). */
  resp: string | null;
  /** Los dos pasos que mueven la entrega automática de cada tema. */
  paso?: PasoEntrega | null;
}

/**
 * La plantilla de fábrica: la que se usa mientras nadie guarde otra.
 *
 * No es inventada. Es el orden que el equipo dejó el 10-sep en
 * `beat_personalizado` y `bp_letra` al editarlas desde el panel — un tema de EP
 * es, trabajo por trabajo, un beat personalizado —, con el mismo reparto de
 * responsables. "Aprobada" también sale de ahí: aparece en las dos, y a mano en
 * cada tema del EP más reciente (P0044).
 *
 * La fila de instrumentos se expande en un paso "Grabar X" por cada
 * instrumento de la venta, en este lugar y no al final.
 */
export const PASOS_CANCION_FABRICA: PasoCancion[] = [
  { clase: "tarea", titulo: "Hacer maqueta", resp: "eliud" },
  { clase: "instrumentos", titulo: "Grabar {instrumento}", resp: "eliud" },
  { clase: "tarea", titulo: "Editar y cuantizar", resp: "diego" },
  { clase: "tarea", titulo: "Mezclar", resp: "luis" },
  { clase: "tarea", titulo: "Masterizar", resp: "luis" },
  { clase: "tarea", titulo: "Aprobada", resp: "luis", paso: "aprobacion" },
  { clase: "tarea", titulo: "Subir a Drive", resp: null, paso: "entrega" },
];
