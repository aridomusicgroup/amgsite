import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { previoMusicoEmail } from "@/lib/emails";
import { hacerPublico } from "@/lib/drive-oauth";
import { avisarClienteDeRender } from "@/lib/render-aviso";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    .select("id, proyecto_id, tipo, estado, compartir, avisado_en, drive_urls, musico_id, opciones")
    .eq("id", jobId)
    .single();

  if (!job) return NextResponse.json({ error: "El trabajo no existe." }, { status: 404 });
  if (job.estado !== "listo") return NextResponse.json({ ok: true, omitido: "el render no terminó" });
  if (job.avisado_en) return NextResponse.json({ ok: true, omitido: "ya se avisó antes" });

  const archivosDrive = (job.drive_urls as { archivo: string; id: string }[] | null) ?? [];
  if (!archivosDrive.length) return NextResponse.json({ ok: true, omitido: "no hay archivos en Drive" });

  // Previo de músico: va a otra persona, por enlace público, con otro correo.
  if (job.musico_id) return avisarMusico(sb, job, archivosDrive);

  // El aviso al cliente vive en lib/render-aviso.ts: el botón "Compartir con el
  // cliente" del panel manda exactamente el mismo correo, y tenerlo dos veces
  // era garantizar que un día dejaran de decir lo mismo.
  return NextResponse.json(await avisarClienteDeRender(sb, jobId));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Le manda al músico de sesión el previo sobre el que va a grabar.
 *
 * A diferencia del cliente, el músico no tiene cuenta en el sitio, así que el
 * archivo se marca como "cualquiera con el enlace" y se le manda esa URL. El
 * enlace queda guardado en `enlace_publico` para poder revocarlo después: sigue
 * abierto hasta que alguien lo cierre.
 */
async function avisarMusico(
  sb: SB,
  job: { id: string; proyecto_id: string; musico_id: string; opciones: Record<string, unknown> | null },
  archivos: { archivo: string; id: string }[],
) {
  const { data: m } = await sb.from("musicos").select("nombre, email, instrumentos").eq("id", job.musico_id).maybeSingle();
  const correo = String(m?.email || "").trim().toLowerCase();
  if (!correo) return NextResponse.json({ ok: true, omitido: "el músico no tiene correo" });

  const enlace = await hacerPublico(archivos[0].id);
  if (!enlace) return NextResponse.json({ ok: true, omitido: "no se pudo generar el enlace de Drive" });

  // Se marca antes de mandar: si el script reintenta, mejor que falte un correo
  // a que al músico le lleguen tres iguales.
  await sb.from("render_jobs").update({ avisado_en: new Date().toISOString(), enlace_publico: enlace }).eq("id", job.id);

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ ok: true, omitido: "Resend no está configurado" });

  const { data: p } = await sb.from("proyectos").select("titulo").eq("id", job.proyecto_id).maybeSingle();
  const op = job.opciones ?? {};
  const mail = previoMusicoEmail({
    musico: String(m?.nombre || "").split(" ")[0] || null,
    proyecto: String(p?.titulo || "la producción"),
    bpm: Number(op.bpm) || 0,
    tonalidad: String(op.tonalidad || "—"),
    instrumentos: (m?.instrumentos as string[] | null) ?? [],
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
    return NextResponse.json({ ok: true, omitido: `Resend falló: ${e instanceof Error ? e.message : e}` });
  }
  return NextResponse.json({ ok: true, avisado: correo });
}
