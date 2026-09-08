import "server-only";
import { Resend } from "resend";
import { previoMusicoEmail } from "@/lib/emails";
import { hacerPublico } from "@/lib/drive-oauth";
import type { ResultadoAviso } from "@/lib/render-aviso";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Le manda al músico de sesión el previo sobre el que va a grabar.
 *
 * Vive aquí, y no dentro de `/api/reaper/aviso` donde nació, porque ahora hay
 * DOS caminos hasta este mismo correo: el script local cuando termina de subir
 * el render, y el botón "Mandar a otro músico" del panel, que reenvía un previo
 * ya hecho sin volver a pasar por REAPER. Es exactamente el motivo por el que
 * existe `render-aviso.ts` para el lado del cliente — duplicarlo era garantizar
 * que un día los dos correos dejaran de decir lo mismo.
 *
 * A diferencia del cliente, el músico no tiene cuenta en el sitio: el archivo se
 * marca como "cualquiera con el enlace" y se le manda esa URL. El enlace queda
 * en `enlace_publico` para poder revocarlo después, y es lo que el portal
 * `/musico` muestra como "pista de referencia".
 *
 * Nunca lanza por falta de datos: devuelve el motivo. El render ya está bien
 * hecho y eso no debe verse como un fallo.
 */
export async function avisarMusicoDeRender(sb: SB, jobId: string): Promise<ResultadoAviso> {
  const { data: job } = await sb
    .from("render_jobs")
    .select("id, proyecto_id, tarea_id, estado, avisado_en, drive_urls, enlace_publico, musico_id, opciones")
    .eq("id", jobId)
    .single();

  if (!job) return { ok: true, omitido: "el trabajo ya no existe" };
  if (!job.musico_id) return { ok: true, omitido: "ese render no va para un músico" };
  if (job.estado !== "listo") return { ok: true, omitido: "el render no terminó" };
  if (job.avisado_en) return { ok: true, omitido: "ya se avisó antes" };

  const archivos = (job.drive_urls as { archivo: string; id: string }[] | null) ?? [];
  if (!archivos.length) return { ok: true, omitido: "no hay archivos en Drive" };

  const { data: m } = await sb
    .from("musicos")
    .select("nombre, email, instrumentos")
    .eq("id", job.musico_id)
    .maybeSingle();
  const correo = String(m?.email || "").trim().toLowerCase();
  if (!correo) return { ok: true, omitido: "el músico no tiene correo" };

  // En un reenvío el archivo ya suele ser público de la vez pasada; `hacerPublico`
  // se traga el 400 de "duplicate" y devuelve la misma URL, así que llamarlo de
  // nuevo no cuesta un permiso extra ni cambia el enlace.
  const enlace = await hacerPublico(archivos[0].id);
  if (!enlace) return { ok: true, omitido: "no se pudo generar el enlace de Drive" };

  // Se marca ANTES de mandar: si el script reintenta o alguien le pica dos veces
  // al botón, vale más que falte un correo a que al músico le lleguen tres.
  await sb
    .from("render_jobs")
    .update({ avisado_en: new Date().toISOString(), enlace_publico: enlace })
    .eq("id", job.id);

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: true, omitido: "Resend no está configurado" };

  const op = (job.opciones ?? {}) as Record<string, unknown>;
  const mail = previoMusicoEmail({
    musico: String(m?.nombre || "").split(" ")[0] || null,
    proyecto: await tituloDelPrevio(sb, job.proyecto_id as string, job.tarea_id as string | null),
    bpm: Number(op.bpm) || 0,
    tonalidad: String(op.tonalidad || "—"),
    instrumentos: (m?.instrumentos as string[] | null) ?? [],
    nota: String(op.nota ?? "").trim() || null,
    url: enlace,
  });

  try {
    const resend = new Resend(key);
    await resend.emails.send({
      from: "Latino Gang Beats <acceso@aridomusicgroup.com>",
      to: correo,
      subject: mail.subject,
      html: mail.html,
    });
  } catch (e) {
    return { ok: true, omitido: `Resend falló: ${e instanceof Error ? e.message : e}` };
  }

  return { ok: true, avisado: correo };
}

/**
 * Cómo se llama lo que va a grabar.
 *
 * En un EP el previo es de UNA canción, y el archivo que baja se llama con el
 * título de esa canción (`jobs.js` arma el patrón con `nombreCarpeta(t.titulo)`).
 * El correo decía el título del ÁLBUM, así que el asunto y el archivo adjunto
 * hablaban de cosas distintas. Manda la canción cuando hay canción.
 */
async function tituloDelPrevio(sb: SB, proyectoId: string, tareaId: string | null): Promise<string> {
  if (tareaId) {
    const { data: t } = await sb.from("proyecto_tareas").select("titulo").eq("id", tareaId).maybeSingle();
    const titulo = String(t?.titulo || "").trim();
    if (titulo) return titulo;
  }
  const { data: p } = await sb.from("proyectos").select("titulo").eq("id", proyectoId).maybeSingle();
  return String(p?.titulo || "").trim() || "la producción";
}
