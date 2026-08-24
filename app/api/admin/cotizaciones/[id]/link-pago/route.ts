import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esEsquemaValido, type EsquemaPago } from "@/lib/esquema-pago";
import { tramosConEstado, siguientePendiente } from "@/lib/cotizacion-pagos";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function staff(): Promise<string | null> {
  const s = await getSession();
  return s && (s.role === "admin" || s.role === "crm") ? s.email : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cargarCotizacion(sb: any, id: string) {
  const { data } = await sb
    .from("cotizaciones")
    .select("id, folio, moneda, total, esquema_pago, num_canciones")
    .eq("id", id)
    .single();
  return data as {
    id: string; folio: string | null; moneda: string; total: number;
    esquema_pago: string | null; num_canciones: number | null;
  } | null;
}

/** Estado de los tramos de pago de una cotización (para pintar la lista en el panel). */
export async function GET(_req: NextRequest, { params }: Props) {
  const email = await staff();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const sb = supabaseAdmin();
  const c = await cargarCotizacion(sb, id);
  if (!c) return NextResponse.json({ error: "No existe." }, { status: 404 });

  const esquema: EsquemaPago = esEsquemaValido(c.esquema_pago) ? c.esquema_pago : "estandar";
  const tramos = await tramosConEstado(sb, id, esquema, Number(c.total) || 0, c.num_canciones);
  return NextResponse.json({ ok: true, moneda: c.moneda, tramos });
}

/**
 * Genera un link de pago de Stripe para el SIGUIENTE tramo pendiente de una
 * cotización. En cuanto Stripe confirme ese pago, el webhook crea la venta
 * (y el proyecto, si aplica) sola desde el primer tramo — ver
 * crearVentaDesdeCotizacionPagada / handleCotizacionPago.
 */
export async function POST(_req: NextRequest, { params }: Props) {
  const email = await staff();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "Stripe no está configurado." }, { status: 503 });

  const { id } = await params;
  const sb = supabaseAdmin();
  const c = await cargarCotizacion(sb, id);
  if (!c) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (!c.folio) return NextResponse.json({ error: "A esta cotización le falta folio." }, { status: 400 });

  const esquema: EsquemaPago = esEsquemaValido(c.esquema_pago) ? c.esquema_pago : "estandar";
  const tramos = await tramosConEstado(sb, id, esquema, Number(c.total) || 0, c.num_canciones);
  const pendiente = siguientePendiente(tramos);
  if (!pendiente) return NextResponse.json({ error: "Esta cotización ya está pagada por completo." }, { status: 400 });
  if (pendiente.monto <= 0) return NextResponse.json({ error: "El monto de ese tramo es $0." }, { status: 400 });

  const stripe = new Stripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: (c.moneda || "MXN").toLowerCase(),
          unit_amount: Math.round(pendiente.monto * 100),
          product_data: { name: `${c.folio} · ${pendiente.label}` },
        },
        quantity: 1,
      },
    ],
    success_url: `${DOMAINS.main}/cotizador/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: DOMAINS.main,
    metadata: {
      tipo: "cotizacion_pago",
      cotizacion_id: id,
      tramo_index: String(pendiente.index),
      tramo_label: pendiente.label.slice(0, 200),
      resumen: `${c.folio} · ${pendiente.label}`.slice(0, 480),
    },
  });

  return NextResponse.json({ ok: true, url: session.url, tramo: pendiente });
}
