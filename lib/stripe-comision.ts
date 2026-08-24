import type Stripe from "stripe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Comisión REAL que Stripe se queda de un cobro — no una estimación. Sale de
 * `balance_transaction.fee` del cargo (Stripe la calcula exacta, con centavos,
 * después de aplicar su tarifa vigente). A diferencia de la comisión de
 * PayPal (que el cliente ve y acepta ANTES de pagar, como % que se le suma),
 * esta se descuenta DESPUÉS, del lado de ARIDO — el cliente nunca la ve ni la
 * paga; es simplemente lo que queda en la mesa, y hasta ahora era invisible.
 *
 * Best-effort a propósito: si Stripe no responde, o el pago no tiene cargo
 * (edge case), regresa `null` — nunca debe tronar el registro del pago en sí.
 */
export async function comisionStripeMxn(
  stripe: Stripe,
  paymentIntentId: string | null,
  fx: number,
): Promise<number | null> {
  if (!paymentIntentId) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = pi.latest_charge as Stripe.Charge | null;
    const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
    if (!bt || typeof bt.fee !== "number") return null;

    const feeEnSuMoneda = bt.fee / 100; // Stripe reporta en centavos de la moneda de LIQUIDACIÓN
    const esMxn = (bt.currency || "").toLowerCase() === "mxn";
    return Math.round((esMxn ? feeEnSuMoneda : feeEnSuMoneda * fx) * 100) / 100;
  } catch (e) {
    console.error("comisionStripeMxn falló (no bloquea el pago):", e);
    return null;
  }
}

/**
 * Registra la comisión de Stripe como un Egreso real — mismo trato contable
 * que la comisión de BeatStars (folio BSC-…): así queda en el libro de
 * Egresos (buscable, filtrable) y entra a gastos operativos por el camino
 * normal, en vez de vivir escondida dentro de un cálculo. `ventaId` liga el
 * egreso a su venta de origen; sin esa columna (SQL sin correr) reintenta
 * sin ella — mismo patrón defensivo que el resto de esta migración.
 */
export async function registrarComisionStripeEgreso(
  sb: SB,
  ventaId: string,
  ventaFolio: string,
  fecha: string,
  monto: number | null,
  detalle?: string | null,
): Promise<void> {
  if (!monto || monto <= 0) return;
  const campos = {
    fecha,
    categoria: "Comisión Stripe",
    proveedor: "Stripe",
    descripcion: `Comisión de Stripe — venta ${ventaFolio}${detalle ? ` (${detalle})` : ""}`,
    total_mxn: monto,
    es_capex: false,
    venta_id: ventaId,
  };
  const { error } = await sb.from("egresos").insert(campos);
  if (error) {
    const { venta_id: _omit, ...sinVentaId } = campos;
    await sb.from("egresos").insert(sinVentaId);
  }
}
