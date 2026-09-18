import "server-only";
import { Resend } from "resend";
import { DOMAINS, SOCIALS } from "@/lib/site";
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

const irAlCurso = (cursoId: string, leccionId?: string) =>
  `${LOGIN}?siguiente=${encodeURIComponent(`/cuenta/curso/${cursoId}${leccionId ? `/leccion/${leccionId}` : ""}`)}`;
const paginaCurso = (slug: string, medio: string) => `${DOMAINS.main}/cursos/${slug}?utm_source=email&utm_medium=${medio}`;
const mxn = (n: number) => `$${n.toLocaleString("es-MX")} MXN`;
const b = (t: string) => `<b style="color:#fff;">${escHtml(t)}</b>`;
/** Correos a la lista Avísame: dicen por qué les llega y cómo darse de baja. */
const baja = nota("Te llega porque pediste que te avisáramos de este curso. Si ya no quieres estos correos, responde BAJA.");

/**
 * Bienvenida al curso (compra con Stripe o acceso dado a mano). En preventa no
 * hay lecciones todavía: sólo confirma su lugar de fundador.
 */
export function bienvenidaCursoEmail(d: { nombre: string | null; curso: string; cursoId: string; preventa?: { lanzamiento: string } | null }) {
  if (d.preventa) {
    const cuando = d.preventa.lanzamiento ? ` Lanzamiento: ${b(d.preventa.lanzamiento)}.` : "";
    const html = wrap(
      bloque(
        "Tu lugar de fundador está apartado 🎸",
        p(`${hola(d.nombre)}ya eres fundador de ${b(d.curso)}.${cuando} Ese día te llega un correo y entras con este mismo correo a todo el curso.`) +
          p("Mientras, crea tu contraseña para tener tu cuenta lista.") +
          boton("Crear mi acceso", irAlCurso(d.cursoId)),
        nota("Elige “Primera vez / olvidé mi contraseña” y usa este mismo correo."),
      ),
      `Tu lugar en ${d.curso} está apartado`,
    );
    return { subject: `🎸 Tu lugar de fundador en ${d.curso} está apartado`, html };
  }
  const html = wrap(
    bloque(
      "¡Bienvenido al curso! 🎸",
      p(`${hola(d.nombre)}ya tienes acceso a ${b(d.curso)}. Entra a tu cuenta y empieza por el Módulo 0: en 20 minutos vas a estar tocando.`) +
        boton("Entrar a mi curso", irAlCurso(d.cursoId)),
      nota("Si es tu primera vez, elige “Primera vez / olvidé mi contraseña” para crear tu contraseña con este mismo correo."),
    ),
    `Tu acceso a ${d.curso} ya está listo`,
  );
  return { subject: `🎸 Ya tienes acceso a ${d.curso}`, html };
}

/** Lanzamiento, a los fundadores: ya pueden entrar. */
export function cursoAbiertoEmail(d: { curso: string; cursoId: string }) {
  const html = wrap(
    bloque(
      "¡Ya abrió el curso! 🎸",
      p(`Gracias por creer desde la preventa. ${b(d.curso)} ya está abierto para ti: empieza por el Módulo 0 y en 20 minutos vas a estar tocando.`) +
        boton("Entrar a mi curso", irAlCurso(d.cursoId)),
      nota("Si es tu primera vez, elige “Primera vez / olvidé mi contraseña” con este mismo correo."),
    ),
    `${d.curso} ya está abierto`,
  );
  return { subject: `🎸 Ya abrió ${d.curso}`, html };
}

/** Lanzamiento, a la lista Avísame: ya se puede inscribir. */
export function cursoAbiertoLeadEmail(d: { curso: string; slug: string; precio: number | null }) {
  const html = wrap(
    bloque(
      "Ya abrió 🎸",
      p(`Nos pediste que te avisáramos: ${b(d.curso)} ya está abierto.${d.precio ? ` Inscríbete por ${mxn(d.precio)} y empieza hoy.` : ""}`) +
        boton("Ver el curso", paginaCurso(d.slug, "avisame_lanzamiento")),
      baja,
    ),
    `${d.curso} ya está abierto`,
  );
  return { subject: `🎸 Ya abrió ${d.curso}`, html };
}

/** A la lista Avísame, 2 días antes de que cierre la preventa. */
export function preventaCierraEmail(d: { curso: string; slug: string; precio: number; regular: number | null; cierre: string }) {
  const fecha = new Date(`${d.cierre}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const html = wrap(
    bloque(
      "Quedan 2 días de preventa ⏳",
      p(`El precio de fundador de ${b(d.curso)} (${mxn(d.precio)}${d.regular ? `, en lugar de ${mxn(d.regular)}` : ""}) se acaba el ${escHtml(fecha)}. Después, el curso se vende al precio normal.`) +
        boton("Apartar mi lugar", paginaCurso(d.slug, "avisame_cierre")),
      baja,
    ),
    `El precio de fundador se acaba el ${fecha}`,
  );
  return { subject: `⏳ Quedan 2 días de preventa: ${d.curso}`, html };
}

/** Estreno de una lección, a los alumnos con acceso. */
export function estrenoEmail(d: { curso: string; cursoId: string; leccion: string; leccionId: string }) {
  const html = wrap(
    bloque(
      "Ya salió lección nueva 🎬",
      p(`${b(d.leccion)} ya está en ${b(d.curso)}. Ábrela, practícala y registra tus minutos en tu bitácora.`) +
        boton("Verla ahora", irAlCurso(d.cursoId, d.leccionId)),
    ),
    `Nueva lección: ${d.leccion}`,
  );
  return { subject: `🎬 Nueva lección: ${d.leccion}`, html };
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

/**
 * El mismo correo a muchos (lanzamiento, estrenos, recordatorio), por lotes de
 * 100 con la API batch de Resend. `clave` evita duplicados si se reintenta.
 * Devuelve cuántos se mandaron.
 */
export async function enviarMasivo(para: string[], correo: { subject: string; html: string }, clave: string): Promise<number> {
  const key = process.env.RESEND_API_KEY;
  const destinos = [...new Set(para.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!key || !destinos.length) return 0;
  const resend = new Resend(key);
  let enviados = 0;
  for (let i = 0; i < destinos.length; i += 100) {
    const lote = destinos.slice(i, i + 100);
    try {
      const { error } = await resend.batch.send(
        lote.map((to) => ({ from: FROM, to, replyTo: SOCIALS.email, subject: correo.subject, html: correo.html })),
        { idempotencyKey: `${clave}-${i / 100}`.slice(0, 256) },
      );
      if (error) console.error("[cursos] lote no enviado:", error.message);
      else enviados += lote.length;
    } catch (e) {
      console.error("[cursos] lote no enviado:", e);
    }
  }
  return enviados;
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
