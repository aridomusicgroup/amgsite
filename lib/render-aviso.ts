import "server-only";
import { Resend } from "resend";
import { renderListoEmail } from "@/lib/emails";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const SITE = "https://aridomusicgroup.com";

/** Ni error ni éxito a secas: casi siempre "salió bien pero no había a quién avisarle". */
export interface ResultadoAviso {
  ok: true;
  avisado?: string;
  omitido?: string;
}

/**
 * Le avisa al cliente que un render ya está en su cuenta.
 *
 * Vive aquí y no dentro de una ruta porque ahora hay DOS caminos hasta el mismo
 * correo: el script local al terminar de subir (`/api/reaper/aviso`), y el botón
 * "Compartir con el cliente" del panel, que existe desde que la casilla de
 * avisar dejó de venir palomeada por defecto. Duplicar esto era garantizar que
 * un día los dos correos dejaran de decir lo mismo.
 *
 * Nunca lanza por falta de datos: si no hay a quién avisarle devuelve el motivo.
 * El render ya está bien hecho y eso no debe verse como un fallo.
 */
export async function avisarClienteDeRender(sb: SB, jobId: string): Promise<ResultadoAviso> {
  const { data: job } = await sb
    .from("render_jobs")
    .select("id, proyecto_id, tipo, estado, compartir, avisado_en, drive_urls")
    .eq("id", jobId)
    .single();

  if (!job) return { ok: true, omitido: "el trabajo ya no existe" };
  if (job.estado !== "listo") return { ok: true, omitido: "el render no terminó" };
  if (job.avisado_en) return { ok: true, omitido: "ya se avisó antes" };
  if (!job.compartir) return { ok: true, omitido: "no se pidió avisar" };

  const archivos = (job.drive_urls as { archivo: string; id: string }[] | null) ?? [];
  if (!archivos.length) return { ok: true, omitido: "no hay archivos en Drive" };

  const { data: p } = await sb
    .from("proyectos")
    .select("titulo, order_id, contactos(nombre, email)")
    .eq("id", job.proyecto_id)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ct = (p?.contactos as any) ?? null;
  const correo = String(ct?.email || "").trim().toLowerCase();
  if (!p?.order_id || !correo) return { ok: true, omitido: "sin pedido ligado o sin correo" };

  // Se marca ANTES de mandar: si Resend responde tarde o alguien le pica dos
  // veces al botón, vale más que falte un correo a que le lleguen tres iguales.
  await sb.from("render_jobs").update({ avisado_en: new Date().toISOString() }).eq("id", jobId);

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: true, omitido: "Resend no está configurado" };

  const mail = renderListoEmail({
    customerName: (ct?.nombre as string | null)?.split(" ")[0] ?? null,
    concepto: (p.titulo as string) || "tu producción",
    tipo: job.tipo as "previo" | "entregables" | "stems",
    archivos: archivos.length,
    url: `${SITE}/cuenta/pedido/${p.order_id}`,
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
    // El archivo YA está visible en su cuenta; sólo no le llegó el correo.
    return { ok: true, omitido: `Resend falló: ${e instanceof Error ? e.message : e}` };
  }

  return { ok: true, avisado: correo };
}
