import "server-only";
import { INSTRUMENTO_DISENO } from "@/lib/diseno";
import { PROVEEDOR_DISENO } from "@/lib/diseno-catalogo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Diseño visual en la venta: lo que se le debe al diseñador y el tema del que
 * sale el proyecto. Lo usan los dos caminos que crean una venta desde una
 * cotización — el anticipo por Stripe (`venta-desde-cotizacion`) y "Convertir
 * en venta" (`/api/admin/ventas`) — para que den lo mismo.
 */

export interface DisenoDeCotizacion {
  folio: string | null;
  /** Lo que se le paga al diseñador, en MXN (congelado al guardar la cotización). */
  costo: number;
  /** El proyecto de la canción que produjimos, si lo hay. */
  origenId: string | null;
}

/**
 * Lo de diseño de una cotización. Tolera que `supabase-diseno.sql` todavía no
 * se haya corrido: sin las columnas no hay nada que registrar (null).
 */
export async function disenoDeCotizacion(sb: SB, cotizacionId: string | null | undefined): Promise<DisenoDeCotizacion | null> {
  if (!cotizacionId) return null;
  const { data, error } = await sb
    .from("cotizaciones")
    .select("folio, costo_proveedor, proyecto_origen_id")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    folio: (data.folio as string | null) ?? null,
    costo: Math.max(0, Number(data.costo_proveedor) || 0),
    origenId: (data.proyecto_origen_id as string | null) ?? null,
  };
}

/** Folio y título del proyecto de la canción, para el PDF y el título del proyecto de diseño. */
export async function temaDeOrigen(sb: SB, proyectoId: string | null | undefined): Promise<{ id: string; folio: string | null; titulo: string } | null> {
  if (!proyectoId) return null;
  const { data } = await sb.from("proyectos").select("id, folio, titulo").eq("id", proyectoId).maybeSingle();
  if (!data) return null;
  return { id: data.id as string, folio: (data.folio as string | null) ?? null, titulo: String(data.titulo || data.folio || "") };
}

/**
 * Deja el pago al diseñador PENDIENTE en "Pagos a músicos" y lo suma al costo
 * de la venta (`costo_extra`), igual que un músico de sesión: así el margen de
 * la venta ya descuenta lo que se le debe, y Finanzas → Pagos le pone el botón
 * Pagar. Idempotente: si la venta ya tiene su pago de diseño, no hace otro.
 * Best-effort: nunca tira la creación de la venta.
 */
export async function registrarPagoDiseno(sb: SB, ventaId: string, d: DisenoDeCotizacion | null): Promise<void> {
  try {
    if (!ventaId || !d || !(d.costo > 0)) return;

    const { data: previos } = await sb.from("pagos_musico").select("musico, nota").eq("venta_id", ventaId);
    const clave = PROVEEDOR_DISENO.toLowerCase();
    const yaEsta = (previos ?? []).some(
      (r: { musico: unknown; nota: unknown }) =>
        String(r.musico ?? "").trim().toLowerCase() === clave || /^auto: diseño/i.test(String(r.nota ?? "")),
    );
    if (yaEsta) return;

    const { data: cat } = await sb.from("musicos").select("id, nombre");
    const m = (cat ?? []).find((x: { nombre: string }) => String(x.nombre).trim().toLowerCase() === clave);

    const fila: Record<string, unknown> = {
      venta_id: ventaId,
      musico_id: m?.id ?? null,
      musico: PROVEEDOR_DISENO,
      instrumento: INSTRUMENTO_DISENO,
      monto: d.costo,
      fecha: null,
      pagado: false,
      nota: `Auto: Diseño${d.folio ? ` (${d.folio})` : ""}`,
    };
    const { error } = await sb.from("pagos_musico").insert(fila);
    if (error) {
      // Esquema viejo sin musico_id/instrumento: mejor el pago sin la liga que sin pago.
      const { musico_id: _m, instrumento: _i, ...basico } = fila;
      void _m; void _i;
      const { error: e2 } = await sb.from("pagos_musico").insert(basico);
      // Es dinero que se le debe a alguien de fuera: que quede rastro en los logs.
      if (e2) { console.error(`registrarPagoDiseno: no se registró el pago de ${d.costo} a ${PROVEEDOR_DISENO} (venta ${ventaId}):`, e2.message); return; }
    }

    // costo_extra = suma de pagos (mismo criterio que la API de pagos-musico).
    const { data: pm } = await sb.from("pagos_musico").select("monto").eq("venta_id", ventaId);
    const sum = (pm ?? []).reduce((a: number, r: { monto: unknown }) => a + (Number(r.monto) || 0), 0);
    await sb.from("ventas").update({ costo_extra: sum }).eq("id", ventaId);
  } catch (e) {
    console.error("registrarPagoDiseno:", e);
  }
}
