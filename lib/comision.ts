// Comisión por cobrar con PayPal, y el total de una cotización.
//
// PayPal se queda un porcentaje de cada cobro. Si no se le suma a la cotización,
// ese porcentaje sale del bolsillo de la casa productora: cotizas 6,000, te
// depositan ~5,640 y la diferencia se la comió la plataforma sin que nadie la
// vea. Por eso se cobra ADEMÁS del precio, como una línea aparte que el cliente
// ve y acepta.
//
// El total vive AQUÍ y en ningún otro lado: lo calculan igual el formulario
// (navegador), la ruta que guarda (servidor) y el PDF que firma el cliente. Si
// cada uno lo hiciera por su cuenta, un día el PDF diría un número y el panel
// otro — y el que manda es el que ya firmó el cliente.

/** Lo que cobra PayPal. Se guarda por documento, así que cambiarlo aquí no toca lo ya cotizado. */
export const COMISION_PAYPAL = 6;

export interface LineaCotizacion {
  qty: number;
  unitPrice: number;
}

export const redondea = (n: number) => Math.round(n * 100) / 100;

export const subtotalDe = (items: LineaCotizacion[]): number =>
  redondea((items ?? []).reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0));

/** Normaliza el porcentaje: fuera de 0–50 se ignora (un dedazo no debe duplicar un cobro). */
export const comisionValida = (pct: unknown): number => {
  const n = Number(pct) || 0;
  return n > 0 && n <= 50 ? n : 0;
};

/** Fuera de 0–50 se ignora — mismo criterio que la comisión de PayPal. */
const fidelidadValida = (pct: unknown): number => {
  const n = Number(pct) || 0;
  return n > 0 && n <= 50 ? n : 0;
};

/**
 * Desglose completo de una cotización.
 *
 * El orden importa, en dos sentidos:
 *  1. El descuento MANUAL (el que escribe el admin) se aplica primero.
 *  2. El descuento por FIDELIDAD (nivel del cliente, lib/fidelidad.ts) se
 *     aplica después, sobre lo que queda — así los dos descuentos no se pisan.
 *  3. La comisión de PayPal se calcula al final, sobre lo que el cliente
 *     REALMENTE va a pagar, porque eso es lo que pasa por PayPal.
 */
export function desglose(items: LineaCotizacion[], descuento: number, comisionPct: unknown, fidelidadPct: unknown = 0) {
  const subtotal = subtotalDe(items);
  const desc = Math.max(0, Number(descuento) || 0);
  const trasDescuentoManual = Math.max(0, subtotal - desc);
  const fpct = fidelidadValida(fidelidadPct);
  const descuentoFidelidad = redondea(trasDescuentoManual * (fpct / 100));
  const base = Math.max(0, trasDescuentoManual - descuentoFidelidad);
  const pct = comisionValida(comisionPct);
  const comision = redondea(base * (pct / 100));
  return {
    subtotal, descuento: desc, fidelidadPct: fpct, descuentoFidelidad,
    base, comisionPct: pct, comision, total: redondea(base + comision),
  };
}

/** Atajo cuando solo interesa el número final. */
export const totalCotizacion = (
  items: LineaCotizacion[], descuento: number, comisionPct: unknown, fidelidadPct: unknown = 0,
): number => desglose(items, descuento, comisionPct, fidelidadPct).total;
