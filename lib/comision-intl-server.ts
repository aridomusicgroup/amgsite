import "server-only";
import { nextFolio } from "@/lib/folio";
import { esMonedaInternacional, montoComisionIntl } from "@/lib/comision-internacional";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * La comisión internacional que el cliente pagó de más se guarda como OTRO
 * INGRESO, no dentro de la venta.
 *
 * Así el precio del producto sigue siendo el precio (métricas, fidelidad y
 * ticket promedio no se inflan), la cuenta cuadra con el banco —ese dinero SÍ
 * entró— y se ve claro cuánto se recuperó de comisiones frente a lo que Stripe
 * se quedó (que se registra aparte como egreso).
 *
 * Idempotente: el webhook de Stripe se reintenta, y `nota` guarda la sesión.
 */
export async function registrarComisionIntlIngreso(
  sb: SB,
  d: { sessionId: string; monto: number; monedaPago: string; fx: number; folio: string; fecha: string },
): Promise<void> {
  if (!(d.monto > 0)) return;
  const marca = `comision-intl:${d.sessionId}`;
  try {
    const { data: ya } = await sb.from("ingresos").select("id").eq("nota", marca).maybeSingle();
    if (ya) return;

    const enPesos = String(d.monedaPago).toUpperCase() === "MXN"
      ? d.monto
      : Math.round(d.monto * d.fx * 100) / 100;

    await sb.from("ingresos").insert({
      folio: await nextFolio(sb, "ingresos", "OI"),
      fecha: d.fecha,
      fuente: "Stripe",
      concepto: `Comisión internacional 7% · ${d.folio}`,
      moneda: "MXN",
      monto_mxn: enPesos,
      recurrente: false,
      nota: marca,
      creado_por: "sitio",
    });
  } catch (e) {
    // Nunca debe tumbar el registro del pago: el dinero ya entró.
    console.error("comision-intl-ingreso:", e);
  }
}

/** Lo que el cliente pagó de comisión, según los metadatos de la sesión de Stripe. */
export const comisionIntlDeMeta = (meta: Record<string, string> | null | undefined): number => {
  const n = Number(meta?.comision_intl);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Cuánta comisión internacional le toca al saldo de una venta.
 *
 * Sólo si la venta es en dólares (cliente de fuera) Y su cotización no la
 * incluía ya en el total: en las que sí, el cliente ya la aceptó y firmó — se
 * la cobraríamos dos veces.
 */
export async function comisionIntlDeSaldo(sb: SB, ventaId: string, saldo: number): Promise<number> {
  try {
    const { data: v } = await sb.from("ventas").select("moneda, cotizacion_id").eq("id", ventaId).maybeSingle();
    if (!v || !esMonedaInternacional(v.moneda as string)) return 0;
    if (v.cotizacion_id) {
      const { data: c } = await sb.from("cotizaciones").select("comision_pct").eq("id", v.cotizacion_id).maybeSingle();
      if ((Number(c?.comision_pct) || 0) > 0) return 0;
    }
    return montoComisionIntl(saldo);
  } catch {
    // Ante la duda, no se le cobra de más.
    return 0;
  }
}
