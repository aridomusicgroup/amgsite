/**
 * Fidelidad por pago completo.
 *
 * Cualquier compra pagada de una sola vez —licencia de BeatStars, tienda,
 * WhatsApp/Instagram sin anticipo, o una cotización "de contado"— suma un
 * escalón permanente. El escalón decide el % de descuento en la SIGUIENTE
 * cotización de contado; nunca baja, ni aunque un crédito individual caduque.
 *
 * Arrancó en cero para todos el 2026-08-07 — sin retroactivo, solo lo que pase
 * de ahí en adelante.
 *
 * Módulo PURO: sin base de datos, para poder probarlo solo.
 */

export interface Nivel {
  nivel: number;
  descuentoPct: number;
  /** Compras que le faltan para el siguiente escalón. null = ya está en el tope. */
  faltanParaSubir: number | null;
}

/** [mínimo de compras pagadas de contado, % de descuento], de menor a mayor. */
const ESCALONES: Array<[minimo: number, pct: number]> = [
  [0, 8],
  [1, 10],
  [3, 12],
  [6, 15], // tope — protege el margen en proyectos grandes
];

export function nivelDe(pagosContadoTotal: number): Nivel {
  const n = Math.max(0, Math.floor(Number(pagosContadoTotal) || 0));
  let actual = ESCALONES[0];
  let idx = 0;
  for (let i = 0; i < ESCALONES.length; i++) {
    if (n >= ESCALONES[i][0]) {
      actual = ESCALONES[i];
      idx = i;
    }
  }
  const siguiente = ESCALONES[idx + 1] ?? null;
  return {
    nivel: idx,
    descuentoPct: actual[1],
    faltanParaSubir: siguiente ? siguiente[0] - n : null,
  };
}

/** Del ahorro que tuvo por el descuento, cuánto se convierte en crédito gastable a futuro. */
export const PCT_CREDITO_DE_AHORRO = 50;

/** Cuántos días dura vivo un crédito antes de caducar. */
export const DIAS_VIGENCIA_CREDITO = 180;

export function creditoDeAhorro(ahorro: number): number {
  return Math.round(Math.max(0, ahorro) * (PCT_CREDITO_DE_AHORRO / 100) * 100) / 100;
}

/**
 * ¿Este tipo de servicio puede llevar descuento por fidelidad?
 *
 * Las licencias de catálogo ya son baratas e instantáneas — SUMAN nivel, pero
 * no llevan descuento aparte. El descuento es el premio para cuando pidan algo
 * grande, no un 8% extra sobre un beat de $834.
 */
export function aplicaDescuentoFidelidad(tipo: string | null | undefined): boolean {
  return tipo === "beat_personalizado" || tipo === "servicio" || tipo === "produccion" || tipo === "ep_album";
}

/** ¿Esta venta cuenta como "pagada de una sola vez"? Mismo criterio que erp-data.ts. */
export function esPagoDeContado(anticipo: number, total: number): boolean {
  const a = Number(anticipo) || 0;
  const t = Number(total) || 0;
  return a === 0 || a >= t;
}
