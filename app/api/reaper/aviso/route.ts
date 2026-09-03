import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderListoEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE = "https://aridomusicgroup.com";

/**
 * Avisa al cliente de que un render ya está en su cuenta.
 *
 * Lo llama el script local cuando termina de subir a Drive. El correo se arma
 * AQUÍ y no allá porque las plantillas y la llave de Resend viven en el sitio;
 * el script sólo dice "este trabajo terminó".
 *
 * Nunca falla de forma que estorbe: si no hay a quién avisarle responde ok con
 * el motivo, y el script sigue su camino. El render ya está bien hecho.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REAPER_SECRET;
  if (!secret) return NextResponse.json({ error: "Falta REAPER_SECRET" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const jobId = String(b.jobId || "").trim();
  if (!jobId) return NextResponse.json({ error: "Falta el trabajo." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: job } = await sb
    .from("render_jobs")
    .select("id, proyecto_id, tipo, estado, compartir, avisado_en, drive_urls")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ error: "El trabajo no existe." }, { status: 404 });
  if (!job.compartir) return NextResponse.json({ ok: true, omitido: "no se pidió avisar" });
  if (job.avisado_en) return NextResponse.json({ ok: true, omitido: "ya se avisó antes" });
  if (job.estado !== "listo") return NextResponse.json({ ok: true, omitido: "el render no terminó" });

  const archivos = (job.drive_urls as unknown[] | null) ?? [];
  if (!archivos.length) return NextResponse.json({ ok: true, omitido: "no hay archivos en Drive" });

  const { data: p } = await sb
    .from("proyectos")
    .select("titulo, order_id, contactos(nombre, email)")
    .eq("id", job.proyecto_id)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ct = (p?.contactos as any) ?? null;
  const correo = String(ct?.email || "").trim().toLowerCase();
  if (!p?.order_id || !correo) {
    return NextResponse.json({ ok: true, omitido: "sin pedido ligado o sin correo" });
  }

  // Se marca ANTES de mandar: si Resend responde tarde o el script reintenta,
  // vale más que falte un correo a que al cliente le lleguen tres iguales.
  await sb.from("render_jobs").update({ avisado_en: new Date().toISOString() }).eq("id", jobId);

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: true, omitido: "Resend no está configurado" });

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
    return NextResponse.json({ ok: true, omitido: `Resend falló: ${e instanceof Error ? e.message : e}` });
  }

  return NextResponse.json({ ok: true, avisado: correo });
}
