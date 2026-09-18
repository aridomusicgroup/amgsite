import "server-only";
import { Resend } from "resend";
import { DOMAINS } from "@/lib/site";
import { escHtml, wrap } from "@/lib/emails";

/**
 * Correos de Cursos (alumno). Mismo marco de marca que el resto (`wrap`).
 * Ninguno lleva un enlace que fije contraseña: todos mandan a /cuenta/login,
 * donde “Primera vez / olvidé mi contraseña” manda su propio enlace de 30 min.
 */

const FROM = "Latino Gang Beats <cursos@aridomusicgroup.com>";
const LOGIN = `${DOMAINS.main}/cuenta/login`;

const boton = (texto: string, url: string) =>
  `<a href="${url}" style="display:block;background:#c42f42;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;">${escHtml(texto)}</a>`;

const bloque = (titulo: string, cuerpo: string, pie = "") => `
    <tr><td>
      <h1 style="color:#fff;font-size:24px;margin:0 0 6px;">${titulo}</h1>
      ${cuerpo}
      ${pie}
    </td></tr>`;

const p = (html: string) => `<p style="color:#999;font-size:14px;margin:0 0 14px;line-height:1.5;">${html}</p>`;
const nota = (html: string) => `<p style="color:#666;font-size:12px;margin:14px 0 0;">${html}</p>`;
const hola = (nombre: string | null) => (nombre ? `${escHtml(nombre)}, ` : "");

/** Bienvenida al curso (compra con Stripe o acceso dado a mano). */
export function bienvenidaCursoEmail(d: { nombre: string | null; curso: string; cursoId: string }) {
  const html = wrap(
    bloque(
      "¡Bienvenido al curso! 🎸",
      p(`${hola(d.nombre)}ya tienes acceso a <b style="color:#fff;">${escHtml(d.curso)}</b>. Entra a tu cuenta y empieza por el Módulo 0: en 20 minutos vas a estar tocando.`) +
        boton("Entrar a mi curso", `${LOGIN}?siguiente=${encodeURIComponent(`/cuenta/curso/${d.cursoId}`)}`),
      nota("Si es tu primera vez, elige “Primera vez / olvidé mi contraseña” para crear tu contraseña con este mismo correo."),
    ),
    `Tu acceso a ${d.curso} ya está listo`,
  );
  return { subject: `🎸 Ya tienes acceso a ${d.curso}`, html };
}

/** El maestro revisó la entrega del alumno. */
export function retroEntregaEmail(d: { nombre: string | null; curso: string; leccion: string; url: string }) {
  const html = wrap(
    bloque(
      "Ya revisamos tu entrega 👀",
      p(`${hola(d.nombre)}tu entrega de <b style="color:#fff;">${escHtml(d.leccion)}</b> (${escHtml(d.curso)}) ya tiene retroalimentación. Compárala con tu autoevaluación: ahí está lo que más vas a aprender.`) +
        boton("Ver mi retroalimentación", d.url),
    ),
    `Tu retroalimentación de ${d.leccion} está lista`,
  );
  return { subject: `👀 Retroalimentación de ${d.leccion}`, html };
}

/** La mensualidad de la mentoría está por vencer. */
export function mentoriaVenceEmail(d: { nombre: string | null; fecha: string; urlPago: string | null }) {
  const html = wrap(
    bloque(
      "Tu mentoría vence pronto ⏳",
      p(`${hola(d.nombre)}tu acceso a la mentoría grupal vence el <b style="color:#fff;">${escHtml(d.fecha)}</b>. Renueva para no perderte las sesiones en vivo ni las grabaciones.`) +
        (d.urlPago ? boton("Renovar un mes", d.urlPago) : p("Escríbenos por WhatsApp para renovar.")),
    ),
    `Tu mentoría vence el ${d.fecha}`,
  );
  return { subject: "⏳ Tu mentoría vence pronto", html };
}

/** Hoy hay sesión en vivo de la mentoría. */
export function sesionHoyEmail(d: { titulo: string; hora: string; url: string }) {
  const html = wrap(
    bloque(
      "Hoy hay sesión en vivo 🔴",
      p(`<b style="color:#fff;">${escHtml(d.titulo)}</b> · ${escHtml(d.hora)} (hora del centro de México). Trae tu docerola afinada y la rola que no te sale.`) +
        boton("Ver la sesión", d.url),
    ),
    `Sesión en vivo hoy a las ${d.hora}`,
  );
  return { subject: `🔴 Hoy: ${d.titulo}`, html };
}

/** Envío best-effort: nunca tumba la operación que lo pidió. */
export async function enviarCorreo(to: string, correo: { subject: string; html: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  try {
    await new Resend(key).emails.send({ from: FROM, to, subject: correo.subject, html: correo.html });
    return true;
  } catch (e) {
    console.error("[cursos] correo no enviado:", e);
    return false;
  }
}
