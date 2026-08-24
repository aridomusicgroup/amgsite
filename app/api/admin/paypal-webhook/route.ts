import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// API de PayPal (live por defecto; sandbox para pruebas).
const PP_API = (process.env.PAYPAL_ENV || "live") === "sandbox"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

async function getToken(): Promise<string | null> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) return null;
  const r = await fetch(`${PP_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const d = await r.json().catch(() => ({}));
  return d.access_token ?? null;
}

// Verifica que el webhook venga realmente de PayPal (firma).
async function verificar(h: Headers, event: unknown, tok: string): Promise<boolean> {
  const r = await fetch(`${PP_API}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      transmission_id: h.get("paypal-transmission-id"),
      transmission_time: h.get("paypal-transmission-time"),
      cert_url: h.get("paypal-cert-url"),
      auth_algo: h.get("paypal-auth-algo"),
      transmission_sig: h.get("paypal-transmission-sig"),
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  });
  const d = await r.json().catch(() => ({}));
  return d.verification_status === "SUCCESS";
}

export function GET() {
  return NextResponse.json({ ok: true, service: "paypal-webhook" });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  // Sin credenciales todavía → acusamos recibo sin procesar (no rompe nada).
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_WEBHOOK_ID) {
    console.log("[paypal] inactivo (faltan credenciales). event:", event?.event_type);
    return NextResponse.json({ ok: true, inactive: true });
  }

  let verified = false;
  try {
    const tok = await getToken();
    if (tok) verified = await verificar(req.headers, event, tok);
  } catch (e) {
    console.error("[paypal] verify error:", (e as Error).message);
  }

  // Fase 1 (mapeo): registramos en el log la estructura REAL de tu venta de
  // BeatStars→PayPal para construir el desglose exacto sin adivinar. La creación
  // de la venta + comisión se enciende en la fase 2, ya con el dato real.
  console.log("[paypal] event_type:", event?.event_type, "| verified:", verified);
  console.log("[paypal] resource:", JSON.stringify(event?.resource ?? {}).slice(0, 1500));

  return NextResponse.json({ ok: true, verified });
}
