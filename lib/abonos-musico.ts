/**
 * Anticipos a músicos: lo que se le ha dado de un pago que aún no se liquida.
 * El pago es uno solo (su `monto` es el costo de la venta); `abonos` sólo dice
 * cuánto de eso ya salió. Sirve igual en servidor y en navegador.
 */
export interface AbonoMusico { monto: number; fecha: string | null; medio_pago: string | null }

export function limpiarAbonos(v: unknown): AbonoMusico[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((a) => ({
      monto: Math.round((Number((a as AbonoMusico)?.monto) || 0) * 100) / 100,
      fecha: typeof (a as AbonoMusico)?.fecha === "string" ? (a as AbonoMusico).fecha : null,
      medio_pago: typeof (a as AbonoMusico)?.medio_pago === "string" ? (a as AbonoMusico).medio_pago : null,
    }))
    .filter((a) => a.monto > 0);
}

export const totalAbonado = (abonos: AbonoMusico[]) => abonos.reduce((s, a) => s + a.monto, 0);

/** Lo que falta por darle. Un pago marcado pagado no debe nada. */
export const restaPorPagar = (monto: number, pagado: boolean, abonos: AbonoMusico[]) =>
  pagado ? 0 : Math.max(0, Math.round((monto - totalAbonado(abonos)) * 100) / 100);
