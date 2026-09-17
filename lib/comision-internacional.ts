/**
 * Comisión por pago internacional.
 *
 * Cobrar en dólares a alguien de fuera cuesta bastante más (tarjeta
 * internacional + conversión de divisa), así que ese costo se le pasa al
 * cliente como un renglón aparte en vez de comérselo en el margen.
 *
 * Se aplica cuando:
 *  - el cobro va en USD (cotizaciones y links de pago en dólares), o
 *  - el comprador NO está en México (tienda de beats, que cobra en USD a todos).
 *
 * Si no se sabe de dónde es, NO se cobra: es peor cobrarle de más a un cliente
 * mexicano que dejar pasar la comisión de uno de fuera.
 */
export const COMISION_INTL_PCT = 0.07;

export const LABEL_COMISION_INTL = {
  es: "Comisión por pago internacional (7%)",
  en: "International payment fee (7%)",
} as const;

/** País de la conexión (header de Vercel). Vacío o desconocido = no se cobra. */
export function esPaisInternacional(pais: string | null | undefined): boolean {
  const p = String(pais ?? "").trim().toUpperCase();
  return p.length === 2 && p !== "MX";
}

/** Moneda del cobro: todo lo que no es peso mexicano lleva comisión. */
export function esMonedaInternacional(moneda: string | null | undefined): boolean {
  const m = String(moneda ?? "").trim().toUpperCase();
  return m.length > 0 && m !== "MXN";
}

/** Los centavos importan: es lo que se le cobra de verdad al cliente. */
export function montoComisionIntl(subtotal: number): number {
  const n = Number(subtotal) || 0;
  if (n <= 0) return 0;
  return Math.round(n * COMISION_INTL_PCT * 100) / 100;
}
