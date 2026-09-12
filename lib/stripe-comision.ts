import type Stripe from "stripe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Cuánto se espera entre intentos. Stripe arma el `balance_transaction` (donde
 * vive la comisión) unos segundos DESPUÉS del cobro: preguntar en el instante en
 * que llega el webhook a veces lo encuentra vacío. Pasó con I0078, I0080 e
 * I0085 (sep-2026) — los tres caminos que preguntan al llegar el pago —
 * mientras la venta del sitio, que pregunta al final, sí la trajo.
 */
const ESPERAS_MS = [0, 1500, 3000, 5000];
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
 * Lo que quede en null lo completa después `completarComisionesStripe`.
 */
export async function comisionStripeMxn(
  stripe: Stripe,
  paymentIntentId: string | null,
  fx: number,
  intentos = ESPERAS_MS.length,
): Promise<number | null> {
  if (!paymentIntentId) return null;
  try {
    for (let i = 0; i < Math.min(intentos, ESPERAS_MS.length); i++) {
      if (ESPERAS_MS[i]) await dormir(ESPERAS_MS[i]);
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      });
      const charge = pi.latest_charge as Stripe.Charge | null;
      const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null;
      if (!bt || typeof bt.fee !== "number") continue;

      const feeEnSuMoneda = bt.fee / 100; // Stripe reporta en centavos de la moneda de LIQUIDACIÓN
      const esMxn = (bt.currency || "").toLowerCase() === "mxn";
      return Math.round((esMxn ? feeEnSuMoneda : feeEnSuMoneda * fx) * 100) / 100;
    }
    return null;
  } catch (e) {
    console.error("comisionStripeMxn falló (no bloquea el pago):", e);
    return null;
  }
}

/** La comisión a partir de la sesión de Checkout (lo que sí guardamos de cada pago). */
export async function comisionDeSesion(stripe: Stripe, sessionId: string, fx: number, intentos = 1): Promise<number | null> {
  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
    return await comisionStripeMxn(stripe, pi, fx, intentos);
  } catch (e) {
    console.error("comisionDeSesion falló:", e);
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

export interface ResultadoComisiones {
  /** Comisiones que se trajeron de Stripe en esta pasada. */
  completadas: number;
  /** Pagos que siguen sin comisión (Stripe aún no la da, o no hay con qué buscarla). */
  pendientes: number;
  detalle: string[];
}

const FX = 18;
/** Un tramo pagado y su renglón en `pagos` se escriben en el mismo webhook: segundos de diferencia. */
const VENTANA_MS = 15 * 60 * 1000;

/**
 * Completa las comisiones de Stripe que quedaron en null: la guarda en el pago
 * (o en la venta del sitio) y registra su egreso, para que el neto de la venta
 * y Finanzas cuadren. La corre un cron diario y el botón de Finanzas.
 *
 * El pago de un TRAMO de cotización no guardaba su sesión de Stripe (desde el
 * 12-sep sí), así que se casa con el tramo pagado de esa cotización más cercano
 * en el tiempo que ningún otro pago haya tomado. Sólo escribe donde la
 * comisión sigue vacía: correrla dos veces no duplica egresos.
 */
export async function completarComisionesStripe(sb: SB, stripe: Stripe): Promise<ResultadoComisiones> {
  const out: ResultadoComisiones = { completadas: 0, pendientes: 0, detalle: [] };

  // 1) Tramos de cotización y saldos pagados por link.
  const { data: pagos } = await sb.from("pagos")
    .select("id, venta_id, fecha, tipo, created_at, stripe_session_id, ventas(folio, cotizacion_id)")
    .ilike("medio_pago", "%stripe%")
    .is("comision_stripe_mxn", null)
    .order("created_at", { ascending: true })
    .limit(50);
  const { data: usadas } = await sb.from("pagos").select("stripe_session_id").not("stripe_session_id", "is", null);
  const tomadas = new Set<string>((usadas ?? []).map((u: { stripe_session_id: string }) => u.stripe_session_id));

  for (const p of pagos ?? []) {
    const venta = p.ventas as { folio: string; cotizacion_id: string | null } | null;
    let sesion = (p.stripe_session_id as string | null) ?? null;
    if (!sesion && venta?.cotizacion_id) {
      const { data: tramos } = await sb.from("cotizacion_pagos")
        .select("stripe_session_id, pagado_at").eq("cotizacion_id", venta.cotizacion_id);
      const t0 = new Date(p.created_at as string).getTime();
      const cerca = ((tramos ?? []) as { stripe_session_id: string | null; pagado_at: string }[])
        .filter((t) => t.stripe_session_id && !tomadas.has(t.stripe_session_id))
        .map((t) => ({ s: t.stripe_session_id as string, d: Math.abs(new Date(t.pagado_at).getTime() - t0) }))
        .filter((x) => x.d < VENTANA_MS)
        .sort((a, b) => a.d - b.d)[0];
      sesion = cerca?.s ?? null;
    }
    if (!sesion) { out.pendientes++; continue; }

    const fee = await comisionDeSesion(stripe, sesion, FX);
    if (!fee) { out.pendientes++; continue; }
    tomadas.add(sesion);

    const { data: upd, error } = await sb.from("pagos")
      .update({ comision_stripe_mxn: fee, stripe_session_id: sesion })
      .eq("id", p.id).is("comision_stripe_mxn", null).select("id");
    if (error || !upd?.length) { out.pendientes++; continue; }
    await registrarComisionStripeEgreso(sb, p.venta_id as string, venta?.folio ?? "", p.fecha as string, fee, (p.tipo as string | null) ?? null);
    out.completadas++;
    out.detalle.push(`${venta?.folio ?? "?"}: $${fee}`);
  }

  // 2) Ventas de beats del sitio: ahí la comisión va en la venta.
  const { data: web } = await sb.from("ventas")
    .select("id, folio, fecha").like("folio", "WEB-cs_%").is("comision_stripe_mxn", null).limit(50);
  for (const v of web ?? []) {
    const fee = await comisionDeSesion(stripe, String(v.folio).slice(4), FX);
    if (!fee) { out.pendientes++; continue; }
    const { data: upd } = await sb.from("ventas").update({ comision_stripe_mxn: fee })
      .eq("id", v.id).is("comision_stripe_mxn", null).select("id");
    if (!upd?.length) continue;
    await registrarComisionStripeEgreso(sb, v.id as string, v.folio as string, v.fecha as string, fee);
    out.completadas++;
    out.detalle.push(`${String(v.folio).slice(0, 14)}…: $${fee}`);
  }

  return out;
}
