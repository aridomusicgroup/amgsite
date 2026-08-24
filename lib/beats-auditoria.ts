// Auditoría de entregabilidad del catálogo de beats.
//
// La pregunta que contesta NO es "¿tiene carpeta?" sino la que de verdad
// importa: **si alguien compra ahorita, ¿le puedo entregar?**. Un beat con
// carpeta pero sin archivos adentro se vende igual y deja al cliente pagando
// por nada — y eso no se ve en el panel hasta que alguien reclama.
//
// La regla sale de `data/licenses.json`, que es lo que el cliente compra:
//   básica        → MP3
//   premium       → MP3 + WAV
//   premium plus  → MP3 + WAV + STEMS
//   exclusiva     → MP3 + WAV + STEMS
//
// Módulo PURO: se puede probar sin Drive ni base de datos.

export const FORMATOS = ["MP3", "WAV", "STEMS"] as const;
export type Formato = (typeof FORMATOS)[number];

/** Qué formatos necesita cada licencia para poder entregarse. */
export const REQUIERE: Record<string, Formato[]> = {
  "Básica": ["MP3"],
  "Premium": ["MP3", "WAV"],
  "Premium Plus": ["MP3", "WAV", "STEMS"],
  "Exclusiva": ["MP3", "WAV", "STEMS"],
};

export type Estado = "completo" | "parcial" | "vacio" | "sin_carpeta";

export interface BeatAuditado {
  id: string;
  title: string;
  origen: "original" | "agregado";
  /** Archivos encontrados por formato. 0 = la subcarpeta existe pero está vacía; ausente = no existe. */
  archivos: Partial<Record<Formato, number>>;
  /** Archivos sueltos en la carpeta raíz del beat (fuera de MP3/WAV/STEMS). */
  sueltos: number;
  estado: Estado;
  /** Licencias que HOY se pueden entregar completas. */
  puedeEntregar: string[];
  /** Licencias que se venden pero NO se pueden entregar. El riesgo real. */
  noPuedeEntregar: string[];
  /**
   * La carpeta que el sistema está mirando. Se expone para poder ABRIRLA: un
   * beat con archivos que se reporta vacío casi siempre está apuntando a la
   * carpeta equivocada, y eso solo se ve entrando a ella.
   */
  carpetaId?: string | null;
  /** ¿La carpeta se asignó a mano desde el panel (en vez de resolverse sola)? */
  manual?: boolean;
}

/** ¿Ese formato está listo? Existe la subcarpeta Y tiene al menos un archivo. */
const listo = (a: Partial<Record<Formato, number>>, f: Formato): boolean => (a[f] ?? 0) > 0;

export function evaluar(
  base: {
    id: string;
    title: string;
    origen: "original" | "agregado";
    tieneCarpeta: boolean;
    carpetaId?: string | null;
    manual?: boolean;
  },
  archivos: Partial<Record<Formato, number>>,
  sueltos: number,
): BeatAuditado {
  const puedeEntregar: string[] = [];
  const noPuedeEntregar: string[] = [];
  for (const [lic, req] of Object.entries(REQUIERE)) {
    (req.every((f) => listo(archivos, f)) ? puedeEntregar : noPuedeEntregar).push(lic);
  }

  const conAlgo = FORMATOS.filter((f) => listo(archivos, f)).length;
  let estado: Estado;
  if (!base.tieneCarpeta) estado = "sin_carpeta";
  // "Vacío" incluye el caso traicionero: carpeta vinculada, subcarpetas creadas
  // y ni un archivo adentro. Se ve sano en el panel y no entrega nada.
  else if (conAlgo === 0 && sueltos === 0) estado = "vacio";
  else if (conAlgo === FORMATOS.length) estado = "completo";
  else estado = "parcial";

  return { ...base, archivos, sueltos, estado, puedeEntregar, noPuedeEntregar };
}

export interface ResumenAuditoria {
  total: number;
  completos: number;
  parciales: number;
  vacios: number;
  sinCarpeta: number;
  /** Cuántos NO pueden entregar ni la licencia más barata. Es la cifra que duele. */
  niLaBasica: number;
  /** Cuántos se venden como Premium Plus / Exclusiva sin poder cumplir. */
  sinStems: number;
}

export function resumir(beats: BeatAuditado[]): ResumenAuditoria {
  return {
    total: beats.length,
    completos: beats.filter((b) => b.estado === "completo").length,
    parciales: beats.filter((b) => b.estado === "parcial").length,
    vacios: beats.filter((b) => b.estado === "vacio").length,
    sinCarpeta: beats.filter((b) => b.estado === "sin_carpeta").length,
    niLaBasica: beats.filter((b) => !b.puedeEntregar.includes("Básica")).length,
    sinStems: beats.filter((b) => !b.puedeEntregar.includes("Premium Plus")).length,
  };
}

/** Orden de revisión: primero lo que más urge arreglar. */
const PESO: Record<Estado, number> = { sin_carpeta: 0, vacio: 1, parcial: 2, completo: 3 };
export const porUrgencia = (a: BeatAuditado, b: BeatAuditado): number =>
  PESO[a.estado] - PESO[b.estado] || a.title.localeCompare(b.title);
