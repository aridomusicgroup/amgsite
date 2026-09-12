/**
 * Los dos pasos que mueven la entrega: "Aprobada" y "Subir a Drive".
 *
 * Módulo puro: lo usan el servidor (el motor que dispara la entrega) y el
 * navegador (el editor de plantillas y la píldora de estado).
 *
 * Por qué una MARCA y no el título: en la base el paso de Drive estaba escrito
 * de cinco maneras ("Subir a drive", "Subir archivos a Drive", "Subir a drive
 * como entregable"…) y "Aprobada" también existía como "Aprovada". Un motor
 * que se engancha al texto se rompe el día que alguien lo teclea distinto; la
 * marca sobrevive a que lo renombren.
 *
 * El título sigue sirviendo de RESPALDO: una tarea escrita a mano o creada
 * antes de la migración se reconoce por cómo se llama. Por eso `pasoDe`
 * primero lee la marca y sólo si no hay, adivina.
 */
export type PasoEntrega = "aprobacion" | "entrega";

export const PASOS: PasoEntrega[] = ["aprobacion", "entrega"];

export const PASO_LABEL: Record<PasoEntrega, string> = {
  aprobacion: "Aprobación",
  entrega: "Entrega",
};

/** El título por defecto con el que nace cada paso. */
export const PASO_TITULO: Record<PasoEntrega, string> = {
  aprobacion: "Aprobada",
  entrega: "Subir a Drive",
};

// Estrictas a propósito. "Aprobar letra" o "Subir nuevos archivos de quinto a
// drive" (existe, es para edición) NO son estos pasos, y confundirlos dispararía
// una entrega a medio proyecto.
const RE_APROBACION = /^\s*(aprobad[oa]|aprovad[oa])\b/i;
const RE_ENTREGA = /^\s*subir\s+(los\s+)?(archivos\s+)?a\s+drive\b/i;

export function pasoDeTitulo(titulo: string | null | undefined): PasoEntrega | null {
  const t = String(titulo ?? "");
  if (RE_APROBACION.test(t)) return "aprobacion";
  if (RE_ENTREGA.test(t)) return "entrega";
  return null;
}

export function esPaso(v: unknown): v is PasoEntrega {
  return v === "aprobacion" || v === "entrega";
}

/** La marca si la hay; si no, lo que diga el título. */
export function pasoDe(x: { paso?: unknown; titulo?: string | null }): PasoEntrega | null {
  return esPaso(x.paso) ? x.paso : pasoDeTitulo(x.titulo);
}

/**
 * Tipos que NO se entregan por este camino: lo interno, el contenido propio,
 * los beats de catálogo (se suben a la tienda, no a un cliente) y la
 * exclusividad (la entrega la hace la tienda al comprar). EP y álbum sí se
 * entregan, pero tema por tema: sus pasos viven en `_cancion`.
 */
const SIN_ENTREGA = ["beat", "contenido", "creacion_contenido", "distribucion", "admin", "exclusividad", "ep", "album"];

export function tipoLlevaPasos(tipo: string | null | undefined): boolean {
  const t = String(tipo ?? "");
  return t === "_cancion" || (!!t && !SIN_ENTREGA.includes(t));
}

// ── Estado de una entrega, para la píldora del tablero ──────────────────────

/** Por qué "Preparar entrega" sigue apagado (tablero y API dicen lo mismo). */
export const ESPERA_PROYECTO = "Se habilita cuando el proyecto pase a En revisión.";
export const ESPERA_TEMA = "Se habilita cuando el tema tenga todo listo menos Aprobada y Subir a Drive.";

export interface JobEntrega {
  id: string;
  tipo: "entregables" | "stems";
  estado: "pendiente" | "renderizando" | "subiendo" | "listo" | "error";
  /** Cuántos trabajos van antes en la cola (0 = es el que sigue o ya corre). */
  antes: number;
  enDrive: boolean;
}

export interface EstadoEntrega {
  proyectoId: string;
  /** El tema, en un EP/álbum. Null en una producción normal. */
  tareaId: string | null;
  /** "Subir a Drive" sigue sin palomear. */
  abierto: boolean;
  /** Ya se puede preparar: el proyecto está En revisión (o, en un EP, el tema). */
  habilitado: boolean;
  /** Por qué todavía no, para el tooltip del botón apagado. */
  porQue: string | null;
  /** Los trabajos del último lote de entrega (vacío si nunca se preparó). */
  jobs: JobEntrega[];
  /** Ya subió todo, pero el cliente no lo ve porque debe saldo. */
  retenido: boolean;
  /** Ya subió todo y el cliente lo ve en su cuenta. */
  compartido: boolean;
}
