import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST: guarda la suscripción push del dispositivo del usuario actual.
export async function POST(req: NextRequest) {
  const email = await getProduccionEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const sub = b.subscription || b;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Suscripción inválida." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("push_subscriptions")
    .upsert({ email: email.toLowerCase(), endpoint, p256dh, auth }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE: quita la suscripción (al desactivar en el dispositivo).
export async function DELETE(req: NextRequest) {
  const email = await getProduccionEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const endpoint = b.endpoint;
  if (!endpoint) return NextResponse.json({ error: "Falta endpoint." }, { status: 400 });

  const sb = supabaseAdmin();
  await sb.from("push_subscriptions").delete().eq("endpoint", String(endpoint));
  return NextResponse.json({ ok: true });
}
