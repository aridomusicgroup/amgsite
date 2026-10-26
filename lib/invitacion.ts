import "server-only";
import { Resend } from "resend";
import { wrap } from "./emails";
import { contenidoInvitacion, enlaceDeInvitacion, esTipoOtp } from "./invitacion-correo";
import { supabaseAdmin } from "./supabase/admin";

type SB = ReturnType<typeof supabaseAdmin>;

const FROM = "Árido Music Group <acceso@aridomusicgroup.com>";

export type ResultadoInvitacion = { ok: true } | { ok: false; error: string };

/**
 * Manda a una persona dada de alta su enlace para entrar al panel.
 *
 * El enlace se genera con la API de administración de Supabase (no cuenta contra
 * el límite de correos de Supabase) y el correo sale por Resend, el mismo
 * canal que ya usan cobranza y entregas. Así la invitación no depende del
 * servidor de correo por defecto de Supabase, que es el que se queda corto.
 *
 * El enlace NUNCA se devuelve a quien llama: viaja sólo por el correo de la
 * persona invitada. Quien invoca esto ya verificó que `email` está en la tabla
 * `usuarios`; aquí no se vuelve a decidir quién tiene acceso.
 */
export async function enviarInvitacion(
  sb: SB,
  d: { email: string; nombre: string | null; rol: string },
): Promise<ResultadoInvitacion> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Correo no configurado (RESEND_API_KEY)." };

  // `magiclink` crea la cuenta si todavía no existe (es lo que hace el login con
  // enlace); Supabase responde en `verification_type` qué tipo de token dejó.
  const { data, error: errLink } = await sb.auth.admin.generateLink({ type: "magiclink", email: d.email });
  const tokenHash = data?.properties?.hashed_token;
  const tipo = data?.properties?.verification_type;
  if (errLink || !tokenHash || !esTipoOtp(tipo)) {
    console.error("[invitacion] no se pudo generar el enlace", { email: d.email, error: errLink?.message, tipo });
    return { ok: false, error: "No se pudo generar el enlace de acceso." };
  }

  const url = enlaceDeInvitacion(tokenHash, tipo);
  const mail = contenidoInvitacion({ nombre: d.nombre, rol: d.rol, url });

  try {
    // Resend no lanza en errores de la API (dominio sin verificar, llave mala…):
    // los devuelve en `error`. Hay que leerlo o un fallo parecería un envío.
    const { error } = await new Resend(key).emails.send({
      from: FROM,
      to: [d.email],
      subject: mail.subject,
      html: wrap(mail.content, mail.preheader),
    });
    if (error) {
      console.error("[invitacion] Resend rechazó el envío", { email: d.email, error: error.message });
      return { ok: false, error: "No se pudo enviar el correo." };
    }
  } catch (e) {
    console.error("[invitacion] falló el envío", { email: d.email, error: e instanceof Error ? e.message : e });
    return { ok: false, error: "No se pudo enviar el correo." };
  }
  return { ok: true };
}
