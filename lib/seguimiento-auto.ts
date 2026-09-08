import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

/**
 * El seguimiento del CRM avanza SOLO conforme avanza el negocio.
 *
 * Antes `contactos.proxima_fecha` solo se movía a mano, y como vender o cotizar
 * no lo tocaban, el recordatorio diario seguía sonando para siempre. El caso que
 * lo destapó: a un cliente que compró ayer el sistema seguía pidiendo
 * "preguntar si sigue interesado".
 *
 * La cadena que sigue el negocio:
 *
 *   cotización creada  → perseguir la cotización     (hay algo que cobrar)
 *   venta LIQUIDADA    → se cierra                   (ya está en producción, nada que perseguir)
 *   venta CON SALDO    → cobrar el saldo             (ver seguimientoDeCobranza)
 *   proyecto entregado → confirmar que quedó conforme (y de ahí lo toma recompra)
 *
 * Recompra sigue igual: su reloj arranca en la ÚLTIMA VENTA, no aquí.
 */

/** Cuántos días esperar antes de recordar cada cosa. */
export const DIAS_TRAS_COTIZACION = 3;
export const DIAS_TRAS_ENTREGA = 3;
/**
 * Cuánto se le da al cliente antes del primer recordatorio de saldo.
 *
 * Una semana: suficiente para que no se sienta cobranza al día siguiente de
 * pagar el anticipo, y poco para que no se enfríe. La antigüedad medida de la
 * cartera es de 9 de 10 saldos por debajo de 30 días — el problema nunca fue
 * el tiempo, fue que nadie preguntaba.
 */
export const DIAS_TRAS_SALDO = 7;

const enDias = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

interface Opciones {
  contactoId: string | null | undefined;
  /** Qué toca hacer. `null` cierra el seguimiento. */
  accion: string | null;
  /** En cuántos días. Se ignora al cerrar. */
  dias?: number;
  /** Por qué cambió, para la línea de tiempo: "vendiste I0067". */
  motivo: string;
  /** Quién disparó el evento (correo). */
  actor?: string | null;
}

/**
 * El seguimiento que deja una venta recién registrada.
 *
 * Aquí estaba el agujero de la cobranza: al registrar una venta se llamaba a
 * `seguimientoAuto` con `accion: null` —cerrando el seguimiento— y hasta
 * DESPUÉS se registraba el anticipo parcial. O sea, **se cerraba el seguimiento
 * justo en el momento en que nacía el saldo**. Medido cuando se encontró: de
 * 10 clientes con saldo, 8 no tenían absolutamente nada agendado, y 6 de esos
 * 10 son clientes recurrentes.
 *
 * Liquidada se sigue cerrando, que era el comportamiento correcto: a alguien
 * que acaba de pagar todo no se le pregunta "si sigue interesado".
 */
export async function seguimientoDeCobranza(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any, any, any>,
  o: { contactoId: string | null | undefined; folio: string; saldo: number; actor?: string | null },
): Promise<void> {
  const haySaldo = o.saldo > 0.5;
  await seguimientoAuto(sb, {
    contactoId: o.contactoId,
    accion: haySaldo ? `Cobrar el saldo de ${o.folio} ($${Math.round(o.saldo).toLocaleString("es-MX")})` : null,
    dias: DIAS_TRAS_SALDO,
    motivo: haySaldo
      ? `se registró la venta ${o.folio} con saldo pendiente`
      : `se cerró la venta ${o.folio}`,
    actor: o.actor ?? null,
  });
}

/**
 * Mueve el seguimiento de un contacto por un evento del negocio.
 *
 * Best-effort a propósito: si esto falla, la cotización o la venta YA quedaron
 * guardadas y no se pierden por un recordatorio.
 */
export async function seguimientoAuto(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any, any, any>,
  { contactoId, accion, dias, motivo, actor }: Opciones,
): Promise<void> {
  if (!contactoId) return;

  try {
    const { data: prev } = await sb
      .from("contactos")
      .select("nombre, proxima_accion, proxima_fecha")
      .eq("id", contactoId)
      .single();
    if (!prev) return;

    const antes = (prev.proxima_accion as string | null) ?? null;
    const fecha = accion ? enDias(dias ?? DIAS_TRAS_COTIZACION) : null;

    // Nada que hacer: cerrar lo que ya está cerrado, o repetir lo mismo.
    if (!accion && !antes) return;
    if (accion && antes === accion && prev.proxima_fecha === fecha) return;

    const { error } = await sb
      .from("contactos")
      .update({ proxima_accion: accion, proxima_fecha: fecha, updated_at: new Date().toISOString() })
      .eq("id", contactoId);
    if (error) return;

    const nombre = (prev.nombre as string | null) ?? "un contacto";
    const quien = actor ? await nombreDeActor(sb, actor) : "El sistema";

    await registrarActividad(sb, {
      tipo: accion ? "seguimiento_programado" : "seguimiento_cerrado",
      titulo: accion
        ? `Seguimiento de ${nombre}: “${accion}” para el ${fecha} (${motivo})`
        : `Se cerró el seguimiento de ${nombre} (${motivo})`,
      actor: actor ?? null,
      entidad: "contacto",
      entidad_id: contactoId,
      entidad_nombre: nombre,
      meta: { accion, fecha, motivo, automatico: true, reemplazo: antes, por: quien },
    });

    // El seguimiento anterior queda escrito: el evento del negocio pisa lo que
    // hubiera, así que la nota que alguien haya dejado a mano no se pierde.
    await sb.from("interacciones").insert({
      contacto_id: contactoId,
      tipo: "seguimiento",
      resumen: accion
        ? `Próxima acción: ${accion} (${fecha}) — automático porque ${motivo}` +
          (antes && antes !== accion ? `. Reemplazó: “${antes}”` : "")
        : `Seguimiento cerrado — automático porque ${motivo}` +
          (antes ? `. Estaba: “${antes}”` : ""),
      ocurrio_at: new Date().toISOString(),
      metadata: { accion, fecha, motivo, automatico: true, reemplazo: antes, autor: actor ?? null },
    });
  } catch {
    /* el recordatorio no puede tumbar la operación que lo disparó */
  }
}
