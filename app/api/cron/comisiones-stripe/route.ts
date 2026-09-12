import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { completarComisionesStripe } from "@/lib/stripe-comision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Una vez al día: trae de Stripe las comisiones que quedaron vacías al llegar
 * el pago (Stripe todavía no las tenía listas). Ver completarComisionesStripe.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ omitido: "sin Stripe" });
  const r = await completarComisionesStripe(supabaseAdmin(), new Stripe(key));
  return NextResponse.json(r);
}
