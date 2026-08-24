/**
 * Detecta pagos a músicos pendientes que llevan tiempo sin liquidarse, para
 * el aviso diario interno al equipo (`/api/cron/pagos-musico`). Módulo PURO:
 * sin base de datos, para poder probarlo solo.
 *
 * No se avisa por algo recién creado (`pagos_musico` nace pendiente en cuanto
 * se registra una venta con instrumentos — ver `crearPagosMusicoPendientes`),
 * solo por lo que lleva `DIAS_MINIMO` o más sin marcarse pagado.
 */

export interface PagoMusicoLite {
  id: string;
  musico: string | null;
  monto: number;
  createdAt: string; // ISO datetime
}

export interface PagoMusicoPendiente extends PagoMusicoLite {
  diasPendiente: number;
}

export const DIAS_MINIMO = 7;

/** Pendientes con `diasMinimo` días de antigüedad o más, del más viejo al más nuevo. */
export function pagosMusicoPendientes(
  pagos: PagoMusicoLite[],
  ahoraISO: string,
  diasMinimo = DIAS_MINIMO,
): PagoMusicoPendiente[] {
  const ahora = new Date(ahoraISO).getTime();
  return pagos
    .map((p) => ({ ...p, diasPendiente: Math.floor((ahora - new Date(p.createdAt).getTime()) / 86400000) }))
    .filter((p) => p.diasPendiente >= diasMinimo)
    .sort((a, b) => b.diasPendiente - a.diasPendiente);
}
