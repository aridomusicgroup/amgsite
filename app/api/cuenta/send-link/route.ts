import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { makeToken } from "@/lib/cuenta-auth";
import { clienteElegible } from "@/lib/cuenta-cliente";
import { SOCIALS, DOMAINS } from "@/lib/site";
import { logoEmailHtml } from "@/lib/emails";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Envía el enlace para CREAR o RESTABLECER la contraseña de un cliente.
 * Por privacidad respondemos siempre OK (no revelamos si el correo existe),
 * pero solo enviamos si el correo tiene al menos una compra o un contrato.
 */
export async function POST(req: NextRequest) {
  // Máx 5 solicitudes por IP cada 10 min (anti-spam de correos)
  if (!rateLimit(`sendlink:${clientIp(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  const { email } = await req.json().catch(() => ({}));
  const clean = String(email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }

  // ¿Cliente existente? (compra O contrato) — solo a ellos les llega el enlace.
  const elegible = await clienteElegible(clean);

  if (elegible && process.env.RESEND_API_KEY) {
    // Dominio FIJO: nunca usar el header Origin (spoofable) para un enlace que
    // fija la contraseña — evitaría desviar el token a un dominio del atacante.
    const link = `${DOMAINS.main}/cuenta/clave?token=${makeToken(clean)}`;
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Latino Gang Beats <acceso@aridomusicgroup.com>",
        to: clean,
        subject: "🌵 Tu contraseña de Mi Cuenta — Latino Gang Beats",
        html: `
<div style="background:#0a0a0a;padding:32px 16px;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;">
      <tr><td align="center" style="padding-bottom:24px;">
        ${logoEmailHtml(150)}
      </td></tr>
      <tr><td style="background:#141414;border:1px solid #222;border-radius:16px;padding:28px;">
        <h1 style="color:#fff;font-size:22px;margin:0 0 8px;">Crea tu contraseña</h1>
        <p style="color:#999;font-size:14px;margin:0 0 20px;">Define tu contraseña para entrar a ver tus beats, contratos y el avance de tus producciones. El enlace expira en 30 minutos.</p>
        <a href="${link}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;">Crear mi contraseña</a>
      </td></tr>
      <tr><td align="center" style="padding-top:24px;">
        <p style="color:#666;font-size:12px;margin:0;">¿No fuiste tú? Ignora este correo.</p>
        <p style="color:#666;font-size:12px;margin:8px 0 0;">
          <a href="${SOCIALS.whatsapp}" style="color:#25D366;text-decoration:none;">WhatsApp</a> ·
          <a href="mailto:${SOCIALS.email}" style="color:#c42f42;text-decoration:none;">${SOCIALS.email}</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</div>`,
      });
    } catch {
      /* no romper el flujo si el correo falla */
    }
  }

  return NextResponse.json({ ok: true });
}
