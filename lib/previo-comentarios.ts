/**
 * Comentarios del cliente sobre un previo — lógica PURA.
 *
 * El cliente escucha su previo en /cuenta/pedido/<id> y escribe lo que quiere
 * cambiar. Cada comentario nace como UNA TAREA del proyecto (título corto de lo
 * que pide, detalle completo adentro) y se guarda además en `previo_comentarios`
 * para tener el histórico: qué pidió, sobre cuál previo, en qué minuto, y si ya
 * se atendió.
 *
 * Sin imports a propósito: lo prueban `lib/previo-comentarios.test.mjs` con
 * `node --test`, y lo importan tanto el servidor como el navegador.
 */

/** Con qué empiezan las notas de una tarea que nació de un comentario del cliente. */
export const MARCA_PEDIDO = "💬 Pedido del cliente";

/** Tope del texto. Más que eso ya no es un comentario, es un correo. */
export const MAX_COMENTARIO = 2000;
/** Largo máximo del resumen que va de título de la tarea. */
export const MAX_RESUMEN = 70;
/** Un previo no dura más de esto; un minuto fuera de rango es un error del navegador. */
const MAX_SEGUNDO = 6 * 3600;

const SALUDO = /^(hola|holi|buenas|buen[oa]s? (d[ií]as|tardes|noches)|oye|hey|bro|compa|wey|g[uü]ey|saludos|gracias)\b[\s,.!:;-]*/i;

/**
 * Lo que pide el cliente, en una frase corta para el título de la tarea.
 *
 * Es la primera idea del texto sin el saludo, y cortada en una palabra
 * completa. No es un resumen "inteligente" a propósito: el texto completo
 * viaja en la tarea, y un resumen inventado puede cambiarle el sentido a un
 * pedido. Esto sólo lo acorta.
 */
export function resumirPedido(texto: string): string {
  let t = String(texto ?? "").replace(/\s+/g, " ").trim();
  // El saludo puede venir repetido ("Hola, oye, ...").
  for (let i = 0; i < 3; i++) {
    const sin = t.replace(SALUDO, "");
    if (sin === t) break;
    t = sin;
  }
  const primera = t.split(/[.!?¡¿\n]+/).map((s) => s.trim()).find((s) => s.length > 0) ?? "";
  if (!primera) return "Comentario del cliente";

  let r = primera.charAt(0).toUpperCase() + primera.slice(1);
  if (r.length > MAX_RESUMEN) {
    const corte = r.slice(0, MAX_RESUMEN);
    const ultimoEspacio = corte.lastIndexOf(" ");
    r = (ultimoEspacio > MAX_RESUMEN * 0.5 ? corte.slice(0, ultimoEspacio) : corte).replace(/[\s,;:-]+$/, "") + "…";
  }
  return r;
}

/** "LA KHABALAH · Previo 2 · Sube el bajo". El tema sólo existe en un EP/álbum. */
export function tituloDeTarea(d: { texto: string; previoNum: number | null; tema: string | null }): string {
  // Igual que en el panel del cliente: el primero es "Previo", desde el segundo lleva número.
  const previo = d.previoNum && d.previoNum > 1 ? `Previo ${d.previoNum}` : "Previo";
  return [d.tema?.trim() || null, previo, resumirPedido(d.texto)].filter(Boolean).join(" · ");
}

export type ComentarioLimpio = { ok: true; texto: string } | { ok: false; error: string };

/** Valida lo que llega del navegador. Nunca corta en silencio: si no cabe, lo dice. */
export function limpiarComentario(raw: unknown): ComentarioLimpio {
  if (typeof raw !== "string") return { ok: false, error: "Escribe tu comentario." };
  const texto = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!texto) return { ok: false, error: "Escribe tu comentario." };
  if (texto.length > MAX_COMENTARIO) {
    return { ok: false, error: `Tu comentario es muy largo (máximo ${MAX_COMENTARIO} caracteres). Divídelo en varios.` };
  }
  return { ok: true, texto };
}

/** El segundo del previo que marcó el cliente, o null si no hay uno creíble. */
export function limpiarSegundo(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 0 && n <= MAX_SEGUNDO ? n : null;
}

/** 83 → "1:23", como lo muestra el reproductor. */
export function formatoMinuto(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Lo que el CLIENTE ve de su propio comentario. A propósito sin la tarea ni el
 * proyecto: son internos, y el navegador del cliente no tiene por qué recibirlos.
 */
export interface ComentarioDelCliente {
  id: string;
  jobId: string | null;
  texto: string;
  segundo: number | null;
  creadoAt: string;
  /** El equipo ya lo atendió (la tarea quedó hecha). */
  atendido: boolean;
}

export function paraCliente(c: ComentarioPrevio): ComentarioDelCliente {
  return { id: c.id, jobId: c.jobId, texto: c.texto, segundo: c.segundo, creadoAt: c.creadoAt, atendido: c.atendido };
}

/** Un comentario tal como lo ve el equipo (con la tarea que nació de él). */
export interface ComentarioPrevio {
  id: string;
  proyectoId: string;
  /** El render (previo) sobre el que se comentó. */
  jobId: string | null;
  previoNum: number | null;
  /** El tema, en un EP/álbum. */
  tema: string | null;
  tareaId: string | null;
  texto: string;
  /** Minuto del previo que marcó el cliente. */
  segundo: number | null;
  creadoAt: string;
  /** La tarea que nació de este comentario ya se palomeó. */
  atendido: boolean;
}
