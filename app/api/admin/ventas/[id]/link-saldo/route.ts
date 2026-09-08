import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { linkDeSaldo } from "@/lib/cobranza";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

/**
 * Link de Stripe para cobrar el SALDO de una venta.
 *
 * Hermano de `/api/admin/cotizaciones/[id]/link-pago`, y existe aparte por una
 * razón concreta y comprobada: aquél cobra el siguiente TRAMO de la cotización
 * según `cotizacion_pagos`, que solo registra pagos confirmados por Stripe. Los
 * clientes que hoy deben pagaron su anticipo por transferencia o efectivo —eso
 * vive en `pagos`—, así que para ellos `cotizacion_pagos` está vacío y ese link
 * les volvería a cobrar el anticipo completo en vez de lo que falta.
 *
 * Ejemplo real: Salvador Martínez debe $3,500 de una venta de $7,000. El link
 * de tramos generaría un cobro de $3,500 por "50% anticipo"… que él ya pagó, y
 * el webhook le acreditaría de más. Aquí el monto sale de la única fuente
 * confiable: `total_mxn − Σ pagos`.
 *
 * Permiso: `admin` o `crm`, el mismo de `link-pago`. Cobrar es del área
 * comercial.
 */
export async function POST(_req: NextRequest, { params }: Props) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "crm")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "Stripe no está configurado." }, { status: 503 });

  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: v } = await sb
    .from("ventas")
    .select("id, folio, total_mxn, beat_nombre, tipo, contacto_id")
    .eq("id", id)
    .maybeSingle();
  if (!v) return NextResponse.json({ error: "Esa venta ya no existe." }, { status: 404 });

  const { data: pagos } = await sb.from("pagos").select("monto_mxn").eq("venta_id", id);
  // Sin NINGÚN pago registrado la venta se cuenta como cobrada (la regla vive
  // en erp-data.ts). Cobrarle a alguien por una venta así es exactamente el
  // error que la pantalla de conciliación existe para evitar.
  if (!pagos?.length) {
    return NextResponse.json(
      { error: "Esta venta no tiene pagos registrados, así que el panel la da por cobrada. Concíliala primero en Ventas." },
      { status: 409 },
    );
  }

  const total = Number(v.total_mxn) || 0;
  const cobrado = pagos.reduce((a, p) => a + (Number(p.monto_mxn) || 0), 0);
  const saldo = Math.round((total - cobrado) * 100) / 100;
  if (saldo <= 0.5) return NextResponse.json({ error: "Esta venta ya está liquidada." }, { status: 409 });

  const concepto = String(v.beat_nombre || v.tipo || "tu producción");

  // Un solo generador de links, compartido con la escalera de cobranza: dos
  // versiones del cálculo del saldo es cómo se acaba cobrando el monto
  // equivocado.
  const url = await linkDeSaldo({ ventaId: id, folio: v.folio ?? "Venta", concepto, saldo });
  if (!url) return NextResponse.json({ error: "No se pudo generar el link de Stripe." }, { status: 502 });

  return NextResponse.json({ ok: true, url, saldo, folio: v.folio, concepto });
}
