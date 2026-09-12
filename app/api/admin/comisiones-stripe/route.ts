import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { completarComisionesStripe } from "@/lib/stripe-comision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Botón de Finanzas: lo mismo que el cron diario, cuando no quieres esperar. */
export async function POST() {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Stripe no está configurado." }, { status: 503 });
  const r = await completarComisionesStripe(supabaseAdmin(), new Stripe(key));
  return NextResponse.json(r);
}
