import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { makeTokenMusico } from "@/lib/musico-auth";
import { accesoMusicoEmail } from "@/lib/emails";
import { DOMAINS } from "@/lib/site";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIAS = 7;

/**
 * "Mándame otro enlace" — que el músico se desatore solo.
 *
 * El enlace dura una semana y no hay contraseña con la que entrar sin él, así
 * que sin esto cada enlace vencido es un mensaje al estudio.
 *
 * SIEMPRE responde ok, mande o no mande el correo. Es la misma regla de
 * `/api/cuenta/send-link`: contestar distinto según si el correo existe
 * convertiría esta ruta en una forma de averiguar con quién trabajamos.
 */
export async function POST(req: NextRequest) {
  // Ruta pública: el límite es lo único que impide usarla para bombardear a
  // alguien de correos.
  if (!rateLimit(`musenlace:${clientIp(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ ok: true });
  }

  const correo = String((await req.json().catch(() => ({}))).email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return NextResponse.json({ ok: true });

  try {
    const sb = supabaseAdmin();
    const { data: m } = await sb.from("musicos")
      .select("id, nombre, activo, portal_activo")
      .eq("email", correo).maybeSingle();
    // Sin portal no se manda nada, y tampoco se dice.
    if (!m || !m.activo || !m.portal_activo) return NextResponse.json({ ok: true });

    const key = process.env.RESEND_API_KEY;
    if (!key) return NextResponse.json({ ok: true });

    const { count } = await sb.from("musico_asignaciones")
      .select("id", { count: "exact", head: true })
      .eq("musico_id", m.id);

    // Dominio FIJO, nunca el header Origin: quien llama a esta ruta lo controla,
    // y desviar este enlace es desviar la llave del portal.
    const enlace = `${DOMAINS.main}/musico/entrar?token=${makeTokenMusico(m.id as string, 60 * 24 * DIAS)}`;
    const { subject, html } = accesoMusicoEmail({
      nombre: String(m.nombre),
      enlace,
      conTrabajo: (count ?? 0) > 0,
    });

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Latino Gang Beats <acceso@aridomusicgroup.com>",
        to: [correo],
        subject,
        html,
      }),
    });
  } catch {
    /* se responde ok igual: no hay nada que el músico pueda hacer con el detalle */
  }

  return NextResponse.json({ ok: true });
}
