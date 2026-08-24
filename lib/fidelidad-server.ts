import { nivelDe, creditoDeAhorro, DIAS_VIGENCIA_CREDITO, type Nivel } from "@/lib/fidelidad";
import { emailsDeCliente } from "@/lib/cuenta-cliente";

/**
 * Capa de datos de fidelidad. Todo best-effort: un fallo aquí nunca debe tumbar
 * el registro de la venta o la cotización que lo dispara — el dinero ya se
 * cobró, perder el punto de fidelidad es un problema menor comparado con
 * perder la venta.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Sube el escalón permanente del contacto y le genera crédito gastable, a
 * partir de una compra que se pagó de una sola vez.
 *
 * `ahorroDelDescuento`: si esta compra YA llevaba descuento por fidelidad
 * (cotización de contado), cuánto se ahorró — de ahí sale el crédito nuevo. Las
 * licencias de catálogo no llevan descuento propio, así que pasan 0 y solo
 * suman escalón.
 */
export async function registrarPagoDeContado(
  sb: SB,
  contactoId: string | null | undefined,
  montoTotal: number,
  origen: { ventaId?: string | null; cotizacionId?: string | null; ahorroDelDescuento?: number },
): Promise<void> {
  if (!contactoId) return;
  try {
    const { data: c } = await sb
      .from("contactos")
      .select("pagos_contado_total, monto_contado_historico")
      .eq("id", contactoId)
      .single();
    if (!c) return;

    await sb
      .from("contactos")
      .update({
        pagos_contado_total: (Number(c.pagos_contado_total) || 0) + 1,
        monto_contado_historico: (Number(c.monto_contado_historico) || 0) + (Number(montoTotal) || 0),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactoId);

    const ahorro = Number(origen.ahorroDelDescuento) || 0;
    if (ahorro > 0.5) {
      const monto = creditoDeAhorro(ahorro);
      const expira = new Date();
      expira.setDate(expira.getDate() + DIAS_VIGENCIA_CREDITO);
      await sb.from("creditos_cliente").insert({
        contacto_id: contactoId,
        origen_venta_id: origen.ventaId ?? null,
        origen_cotizacion_id: origen.cotizacionId ?? null,
        monto,
        motivo: "50% del ahorro por pagar de contado",
        expira_at: expira.toISOString(),
      });
    }

    // Marca la venta como "ya contada" — es lo único que permite, más tarde,
    // revertir el escalón si se borra la venta o deshacer un pago la vuelve a
    // dejar incompleta (ver revertirFidelidadDeVenta / sincronizarFidelidadVenta).
    // Si la columna todavía no existe, esto falla en silencio sin tumbar nada
    // de lo de arriba — el nivel/crédito ya se sumaron bien.
    if (origen.ventaId) {
      await sb.from("ventas").update({ fidelidad_contada: true }).eq("id", origen.ventaId);
    }
  } catch {
    /* nunca tumba el registro de la venta que lo disparó */
  }
}

/**
 * Deshace lo que había sumado una venta: baja el escalón permanente del
 * contacto y borra el crédito que esa venta hubiera generado, PERO solo si
 * ese crédito sigue sin gastar — uno ya usado en otra cotización ya movió esa
 * cotización, y tocarlo ahora la dejaría descuadrada. Es el costo de haberlo
 * gastado ya, no se revierte en cascada.
 */
export async function revertirFidelidadDeVenta(
  sb: SB,
  contactoId: string | null | undefined,
  ventaId: string,
  montoTotal: number,
): Promise<void> {
  if (!contactoId) return;
  try {
    const { data: c } = await sb
      .from("contactos")
      .select("pagos_contado_total, monto_contado_historico")
      .eq("id", contactoId)
      .single();
    if (!c) return;

    await sb
      .from("contactos")
      .update({
        pagos_contado_total: Math.max(0, (Number(c.pagos_contado_total) || 0) - 1),
        monto_contado_historico: Math.max(0, (Number(c.monto_contado_historico) || 0) - (Number(montoTotal) || 0)),
        updated_at: new Date().toISOString(),
      })
      .eq("id", contactoId);

    await sb.from("creditos_cliente").delete().eq("origen_venta_id", ventaId).is("usado_at", null);
  } catch {
    /* best-effort */
  }
}

/**
 * Revisa cuánto se ha pagado de una venta (tabla `pagos`; sin filas capturadas
 * = cobrada al 100%, la misma convención que ya usa /api/admin/pagos) y
 * prende o apaga su escalón de fidelidad según corresponda. Se llama después
 * de CUALQUIER cambio a los pagos de una venta — así completar el saldo
 * DESPUÉS de creada también suma, y editar un pago hacia abajo también
 * revierte. No hace nada (a propósito) si `fidelidad_contada` no se puede
 * leer todavía — sin esa columna no hay forma confiable de saber si ya se
 * contó, y contar de más es peor que no contar.
 */
export async function sincronizarFidelidadVenta(sb: SB, ventaId: string | null | undefined): Promise<void> {
  if (!ventaId) return;
  try {
    const { data: venta, error } = await sb
      .from("ventas")
      .select("contacto_id, total_mxn, fidelidad_contada")
      .eq("id", ventaId)
      .single();
    if (error || !venta) return;

    const { data: pagos } = await sb.from("pagos").select("monto_mxn").eq("venta_id", ventaId);
    const cobrado = (pagos ?? []).reduce((a: number, p: { monto_mxn: number }) => a + (Number(p.monto_mxn) || 0), 0);
    const total = Number(venta.total_mxn) || 0;
    const completa = (pagos ?? []).length === 0 || cobrado >= total - 0.5;
    const yaContada = !!venta.fidelidad_contada;

    if (completa && !yaContada) {
      await registrarPagoDeContado(sb, venta.contacto_id, total, { ventaId });
    } else if (!completa && yaContada) {
      await revertirFidelidadDeVenta(sb, venta.contacto_id, ventaId, total);
      await sb.from("ventas").update({ fidelidad_contada: false }).eq("id", ventaId);
    }
  } catch {
    /* nunca tumba el flujo de pagos que lo disparó */
  }
}

// Antes de correr supabase-fidelidad-cliente.sql, la columna no existe todavía.
// Un contacto real en el escalón 0 SÍ lleva 8% (es el primer premio); en
// cambio "no se pudo leer el nivel" debe dar 0% — si no, en cuanto se
// desplegara el código, cualquier cotización "de contado" ya estaría dando un
// descuento que nadie autorizó a propósito, sin haber corrido la migración.
const SIN_DATOS: Nivel = { nivel: 0, descuentoPct: 0, faltanParaSubir: null };

/** El nivel de fidelidad de un contacto ahora mismo. Sin contacto = nivel 0 real (8%). */
export async function nivelDeContacto(sb: SB, contactoId: string | null | undefined): Promise<Nivel> {
  if (!contactoId) return nivelDe(0);
  try {
    const { data, error } = await sb.from("contactos").select("pagos_contado_total").eq("id", contactoId).single();
    if (error) return SIN_DATOS;
    return nivelDe(Number(data?.pagos_contado_total) || 0);
  } catch {
    return SIN_DATOS;
  }
}

export interface FidelidadCliente extends Nivel {
  creditoDisponible: number;
}

/**
 * El nivel de fidelidad de un CLIENTE (panel /cuenta), resuelto por su
 * correo — puede tener varios correos ligados a la misma ficha, igual que el
 * resto del panel de cliente. Sin contacto = nivel 0, sin crédito.
 */
export async function nivelDeCliente(sb: SB, email: string): Promise<FidelidadCliente> {
  try {
    const emails = await emailsDeCliente(email);
    if (!emails.length) return { ...nivelDe(0), creditoDisponible: 0 };
    const { data } = await sb
      .from("contactos")
      .select("id, pagos_contado_total")
      .in("email", emails)
      .is("merged_into", null)
      .limit(1);
    const c = data?.[0];
    if (!c) return { ...nivelDe(0), creditoDisponible: 0 };
    const [nivel, credito] = await Promise.all([
      Promise.resolve(nivelDe(Number(c.pagos_contado_total) || 0)),
      creditoDisponible(sb, c.id as string),
    ]);
    return { ...nivel, creditoDisponible: credito };
  } catch {
    return { ...nivelDe(0), creditoDisponible: 0 };
  }
}

/** Cuánto crédito gastable tiene disponible (sin caducar, sin usar) ahora mismo. */
export async function creditoDisponible(sb: SB, contactoId: string | null | undefined): Promise<number> {
  if (!contactoId) return 0;
  try {
    const { data } = await sb
      .from("creditos_cliente")
      .select("monto")
      .eq("contacto_id", contactoId)
      .is("usado_at", null)
      .gt("expira_at", new Date().toISOString());
    return (data ?? []).reduce((a: number, r: { monto: number }) => a + (Number(r.monto) || 0), 0);
  } catch {
    return 0;
  }
}

/**
 * Aplica hasta `monto` del crédito disponible a una cotización, más viejo
 * primero (el que está más cerca de caducar se gasta antes). Devuelve lo que
 * de verdad se pudo aplicar — puede ser menos de lo pedido si no alcanza.
 */
export async function aplicarCredito(sb: SB, contactoId: string, cotizacionId: string, monto: number): Promise<number> {
  try {
    const { data } = await sb
      .from("creditos_cliente")
      .select("id, monto")
      .eq("contacto_id", contactoId)
      .is("usado_at", null)
      .gt("expira_at", new Date().toISOString())
      .order("expira_at", { ascending: true });

    let restante = Math.max(0, Number(monto) || 0);
    let aplicado = 0;
    for (const cred of data ?? []) {
      if (restante <= 0) break;
      const m = Number(cred.monto) || 0;
      const usar = Math.min(m, restante);
      await sb
        .from("creditos_cliente")
        .update({ usado_en_cotizacion_id: cotizacionId, usado_at: new Date().toISOString() })
        .eq("id", cred.id);
      // Nota: se marca el crédito COMPLETO como usado aunque solo se necesitara
      // una parte — partir un crédito en dos filas es más fricción de la que
      // vale para montos que ya de por sí son un % de un ahorro. Simplicidad
      // sobre precisión al centavo.
      aplicado += usar;
      restante -= usar;
    }
    return aplicado;
  } catch {
    return 0;
  }
}
