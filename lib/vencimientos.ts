// Atrasos y vencimientos: qué se pasó de fecha y qué vence mañana.
//
// Módulo PURO: la MISMA regla la usan el chip "Atrasados" del tablero y el
// aviso push. Si cada uno tuviera la suya, el tablero diría 8 y la notificación
// 6, y nadie sabría cuál creer.
//
// Aviso AGRUPADO por persona, uno al día: con 8 proyectos atrasados hoy, mandar
// un push por cada uno serían 6 notificaciones para Eliud en un minuto y las
// apagaría el mismo día. Uno solo que diga "vamos tarde en 6" se lee.

/** Estados en los que el proyecto ya salió del tablero y deja de contar. */
export const FUERA_TABLERO = ["entregado", "cerrado", "cancelado"];

export const hoyISO = (): string => new Date().toISOString().slice(0, 10);

const diasEntre = (desde: string, hasta: string) =>
  Math.round((new Date(hasta + "T12:00:00").getTime() - new Date(desde + "T12:00:00").getTime()) / 86400000);

/** Se pasó de la fecha comprometida y sigue abierto. */
export function estaAtrasado(fecha: string | null, estado: string, hoy = hoyISO()): boolean {
  return !!fecha && fecha < hoy && !FUERA_TABLERO.includes(estado);
}

/** Vence exactamente mañana (el aviso con un día de anticipación). */
export function venceManana(fecha: string | null, estado: string, hoy = hoyISO()): boolean {
  if (!fecha || FUERA_TABLERO.includes(estado)) return false;
  return diasEntre(hoy, fecha) === 1;
}

/** Cuántos días lleva tarde (siempre ≥ 1 cuando está atrasado). */
export const diasTarde = (fecha: string, hoy = hoyISO()): number =>
  Math.max(1, diasEntre(fecha, hoy));

/** Una cosa que se venció o está por vencerse. */
export interface ItemVenc {
  /** Id del proyecto o de la tarea: es lo que abre esa cosa al tocar el push. */
  id: string;
  clase: "proyecto" | "tarea";
  titulo: string;
  /** Proyecto al que pertenece (solo tareas). */
  proyecto: string | null;
  fecha: string;
  /** 0 cuando todavía no vence. */
  tarde: number;
}

/** "Subir a drive (MGTS)" para tareas · "XITO EP" para proyectos. */
export const nombreDe = (i: ItemVenc): string =>
  i.clase === "tarea" && i.proyecto ? `${i.titulo} (${i.proyecto})` : i.titulo;

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);
const dias = (n: number) => `${n} ${plural(n, "día", "días")}`;

/** Un proyecto tiene "fecha de entrega"; una tarea nada más tiene fecha. */
const queFecha = (i: ItemVenc) => (i.clase === "proyecto" ? "fecha de entrega" : "fecha");

export interface Aviso {
  titulo: string;
  cuerpo: string;
  /** Con qué filtro abrir el tablero al tocar la notificación. */
  foco: "atrasados" | "semana";
  /** Cuando el aviso es de UNA sola cosa, su id: el push abre esa y la resalta. */
  id: string | null;
}

/**
 * Arma el aviso de una persona a partir de lo suyo.
 *
 * El tono es deliberado: la advertencia va acompañada SIEMPRE de la salida
 * ("ponle nueva fecha"). Un aviso que solo regaña se ignora a los tres días;
 * uno que pide una acción concreta se puede cerrar — y al poner fecha nueva, el
 * proyecto deja de aparecer hasta que esa fecha llegue.
 */
export function armarAviso(atrasados: ItemVenc[], manana: ItemVenc[]): Aviso | null {
  if (!atrasados.length && !manana.length) return null;

  // El más atrasado da el ejemplo concreto: un número sin nombre no mueve a nadie.
  const peor = [...atrasados].sort((a, b) => b.tarde - a.tarde)[0];
  const soloUno = atrasados.length + manana.length === 1;
  const id = soloUno ? (atrasados[0] ?? manana[0]).id : null;

  if (atrasados.length && manana.length) {
    return {
      titulo: `⚠️ ${atrasados.length} ${plural(atrasados.length, "atrasado", "atrasados")} · ${manana.length} ${plural(manana.length, "vence", "vencen")} mañana`,
      cuerpo: `${nombreDe(peor)} lleva ${dias(peor.tarde)} · Ponle nueva ${queFecha(peor)} y seguimos.`,
      foco: "atrasados",
      id,
    };
  }

  if (atrasados.length) {
    return atrasados.length === 1
      ? {
          titulo: `⚠️ ${nombreDe(peor)} lleva ${dias(peor.tarde)} tarde`,
          cuerpo: `Ponle una nueva ${queFecha(peor)} para volver a tener meta. 🌵`,
          foco: "atrasados",
          id,
        }
      : {
          titulo: `⚠️ Vamos tarde en ${atrasados.length}`,
          cuerpo: `${nombreDe(peor)} lleva ${dias(peor.tarde)} · Ponles nueva fecha y seguimos. 🌵`,
          foco: "atrasados",
          id,
        };
  }

  const primero = manana[0];
  return manana.length === 1
    ? {
        titulo: `📅 Mañana vence ${nombreDe(primero)}`,
        cuerpo: "Todavía te da. Si ves que no llega, muévele la fecha hoy y no mañana.",
        foco: "semana",
        id,
      }
    : {
        titulo: `📅 Mañana vencen ${manana.length}`,
        cuerpo: `${manana.slice(0, 2).map(nombreDe).join(" · ")}${manana.length > 2 ? ` · y ${manana.length - 2} más` : ""}`,
        foco: "semana",
        id,
      };
}
