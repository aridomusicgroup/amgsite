import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { avisarClienteDeRender } from "@/lib/render-aviso";
import { avisarMusicoDeRender } from "@/lib/musico-aviso";

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
  const { data: job } = await sb.from("render_jobs").select("id, musico_id").eq("id", jobId).single();
  if (!job) return NextResponse.json({ error: "El trabajo no existe." }, { status: 404 });

  // Sólo se decide POR DÓNDE va; las dos librerías revalidan lo suyo y devuelven
  // el motivo cuando no hay a quién avisarle. Existen aparte porque el panel
  // llega a las dos por su cuenta: "Compartir con el cliente" y "Mandar a otro
  // músico" mandan exactamente estos mismos correos, y tenerlos duplicados era
  // garantizar que un día dejaran de decir lo mismo.
  return NextResponse.json(
    job.musico_id
      ? await avisarMusicoDeRender(sb, jobId)
      : await avisarClienteDeRender(sb, jobId),
  );
}
