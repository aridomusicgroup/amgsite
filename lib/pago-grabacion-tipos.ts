/**
 * La pregunta "¿le pagas al músico?" que sale al palomear una grabación.
 * Vive aparte del cálculo (que es server-only) porque la usan las dos orillas:
 * el servidor la arma y el navegador la pinta.
 */
export interface PreguntaPago {
  proyectoId: string;
  /** El tema, si es EP/álbum. null = proyecto normal. */
  temaId: string | null;
  /** "EL NECIO", o "TRiP MX · LA KHABALAH" en un EP. */
  donde: string;
  instrumento: string;
  musico: string;
  ventaId: string;
  /** El pago pendiente que ya existe. null = no hay, la ventana lo registra. */
  pagoId: string | null;
  /** Lo que cuesta en total (el pago, o la tarifa del catálogo si es nuevo). */
  monto: number;
  /** Lo que ya se le ha dado en anticipos. */
  abonado: number;
  /** Lo que falta por darle. */
  pendiente: number;
  /**
   * Lo que se sugiere darle AHORA. En un proyecto normal es todo lo pendiente;
   * en un EP, la parte de este tema (pendiente ÷ temas que le quedan por grabar),
   * porque es UN pago por toda la venta y se pregunta en cada tema.
   */
  sugerido: number;
  /** En un EP: cuántos temas de su instrumento le faltan contando éste. */
  temasRestantes: number | null;
}

/** Evento con el que una palomita le pide al lanzador que pregunte. */
export const EVENTO_PAGO_MUSICO = "arido:pago-musico";

/** Parámetro de la URL con el que el push abre la pregunta: `proyecto:tema:instrumento`. */
export const PARAM_PAGO_MUSICO = "pagar_musico";

/** "Grabar Charchetas" → "Charchetas". null si la tarea no es una grabación. */
export function instrumentoDeTarea(titulo: string | null | undefined): string | null {
  const m = /^\s*grabar\s+(.+?)\s*$/i.exec(String(titulo ?? ""));
  return m ? m[1] : null;
}
