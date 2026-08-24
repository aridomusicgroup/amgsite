import "server-only";
import { tramosDe, type EsquemaPago } from "@/lib/esquema-pago";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface TramoEstado {
  index: number;
  label: string;
  monto: number;
  pagado: boolean;
  pagadoAt: string | null;
}

/**
 * Los tramos de una cotización (lib/esquema-pago.ts) cruzados con lo que ya se
 * pagó de verdad (tabla `cotizacion_pagos`, solo pagos confirmados por Stripe).
 */
export async function tramosConEstado(
  sb: SB,
  cotizacionId: string,
  esquema: EsquemaPago,
  total: number,
  numCanciones?: number | null,
): Promise<TramoEstado[]> {
  const tramos = tramosDe(esquema, total, numCanciones);
  const { data: pagos } = await sb
    .from("cotizacion_pagos")
    .select("tramo_index, pagado_at")
    .eq("cotizacion_id", cotizacionId);
  const pagadoPorIndex = new Map<number, string>(
    (pagos ?? []).map((p: { tramo_index: number; pagado_at: string }) => [p.tramo_index, p.pagado_at]),
  );
  return tramos.map((t, i) => ({
    index: i,
    label: t.label,
    monto: t.monto,
    pagado: pagadoPorIndex.has(i),
    pagadoAt: pagadoPorIndex.get(i) ?? null,
  }));
}

/** El primer tramo que todavía no se ha pagado — null si ya está todo cubierto. */
export const siguientePendiente = (tramos: TramoEstado[]): TramoEstado | null =>
  tramos.find((t) => !t.pagado) ?? null;
