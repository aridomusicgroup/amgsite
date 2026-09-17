import { NextRequest, NextResponse } from "next/server";
import { esPaisInternacional } from "@/lib/comision-internacional";

export const dynamic = "force-dynamic";

/**
 * De qué país llega la visita, según Vercel. Lo usa el carrito para avisar
 * ANTES de pagar que un pago de fuera de México lleva comisión.
 *
 * El cobro de verdad no depende de esto: el servidor lo vuelve a decidir al
 * crear la sesión de Stripe, así que tocar esta respuesta no cambia el precio.
 */
export async function GET(req: NextRequest) {
  const pais = req.headers.get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null;
  return NextResponse.json(
    { pais, internacional: esPaisInternacional(pais) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
