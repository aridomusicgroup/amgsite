import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { makeTokenMusico } from "@/lib/musico-auth";
import { accesoMusicoEmail } from "@/lib/emails";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Una semana: no hay contraseña con la que entrar por su cuenta si se vence. */
const DIAS = 7;

/**
 * Le manda a un músico el enlace de su portal, sin asignarle nada.
 *
 * Antes el enlace solo nacía al asignarle una tarea, así que prenderle el
 * portal a alguien no le servía de nada hasta ese momento — y mientras tanto
 * acababa intentando entrar por el panel de clientes con su correo, donde
 * `clienteElegible()` exige una compra o un contrato y por eso NUNCA le llega
 * nada (devuelve "ok" sin enviar, para no revelar qué correos existen).
 */
export async function POST(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = String((await req.json().catch(() => ({}))).id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el músico." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: m } = await sb.from("musicos")
    .select("id, nombre, email, activo, portal_activo")
    .eq("id", id).maybeSingle();
  if (!m) return NextResponse.json({ error: "Ese músico ya no existe." }, { status: 404 });

  const correo = String(m.email || "").trim().toLowerCase();
  if (!correo) return NextResponse.json({ error: `${m.nombre} no tiene correo registrado.` }, { status: 409 });
  if (!m.activo || !m.portal_activo) {
    return NextResponse.json({ error: `${m.nombre} no tiene el portal prendido.` }, { status: 409 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "El correo no está configurado (falta RESEND_API_KEY)." }, { status: 503 });

  // Si ya tiene algo asignado se le dice en el correo, para que sepa qué esperar.
  const { count } = await sb.from("musico_asignaciones")
    .select("id", { count: "exact", head: true })
    .eq("musico_id", m.id);

  // Dominio FIJO, nunca el header Origin: este enlace ES la llave del portal.
  const enlace = `${DOMAINS.main}/musico/entrar?token=${makeTokenMusico(m.id as string, 60 * 24 * DIAS)}`;
  const { subject, html } = accesoMusicoEmail({
    nombre: String(m.nombre),
    enlace,
    conTrabajo: (count ?? 0) > 0,
  });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Latino Gang Beats <acceso@aridomusicgroup.com>",
        to: [correo],
        subject,
        html,
      }),
    });
    if (!r.ok) {
      const detalle = await r.text().catch(() => "");
      return NextResponse.json({ error: `El correo no salió: ${detalle.slice(0, 200) || r.status}` }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo mandar" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, enviado: correo });
}
