import { NextRequest, NextResponse } from "next/server";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TIPO_RENDER_LABEL, type TipoRender } from "@/lib/render-jobs";
import { registrarActividad } from "@/lib/actividad";

export const dynamic = "force-dynamic";

/**
 * Vuelve a lanzar un render que terminó en 'error' — SOBRE EL MISMO TRABAJO.
 *
 * Importa que sea el mismo y no uno nuevo: el lote de una entrega se cierra (y le
 * llega el correo al cliente) sólo cuando TODOS sus renders están listos y en
 * Drive. Un trabajo nuevo nacería sin la marca del lote y el viejo, en error, lo
 * dejaría abierto para siempre; además repetiría los stems que ya subieron.
 * SRT, 12-nov: se cerró la ventana de render, los entregables cayeron en error y
 * "reintentar" abría el cuadro de entrega desde cero.
 *
 * Mismo permiso que lanzar un render: esto enciende REAPER en la máquina del estudio.
 */
export async function POST(req: NextRequest) {
  const email = await moduloPermitido("/admin/dev-logs");
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el render." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: job } = await sb
    .from("render_jobs")
    .select("id, proyecto_id, tarea_id, tipo, estado, opciones")
    .eq("id", id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Ese render ya no existe." }, { status: 404 });
  if (job.estado !== "error") {
    return NextResponse.json({ error: "Ese render no está en error; no hay nada que reintentar." }, { status: 409 });
  }

  // Dos del mismo tipo para lo mismo se pisarían el archivo de salida.
  let enVuelo = sb
    .from("render_jobs")
    .select("id")
    .eq("proyecto_id", job.proyecto_id)
    .eq("tipo", job.tipo)
    .neq("id", job.id)
    .in("estado", ["pendiente", "renderizando", "subiendo"]);
  enVuelo = job.tarea_id ? enVuelo.eq("tarea_id", job.tarea_id) : enVuelo.is("tarea_id", null);
  const { data: yaHay } = await enVuelo.limit(1);
  if (yaHay?.length) return NextResponse.json({ error: "Ya hay otro render de ese tipo en curso." }, { status: 409 });

  // El contador de reintentos automáticos de reaper-sync arranca de cero: quien
  // reintenta a mano está mirando, y merece sus intentos completos.
  const { reintentos: _contador, ...resto } = (job.opciones as Record<string, unknown> | null) ?? {};

  // `.eq("estado", "error")` otra vez: si entre la lectura y esto otro clic ya lo
  // reactivó, no se pisa.
  const { data: tomado, error } = await sb
    .from("render_jobs")
    .update({
      estado: "pendiente",
      error: null,
      opciones: Object.keys(resto).length ? resto : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("estado", "error")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tomado?.length) return NextResponse.json({ error: "Ese render ya se estaba reintentando." }, { status: 409 });

  const tipo = job.tipo as TipoRender;
  await registrarActividad(sb, {
    tipo: "render_reintentado",
    titulo: `↻ Se volvió a lanzar el render de ${(TIPO_RENDER_LABEL[tipo] ?? job.tipo).toLowerCase()}`,
    actor: email,
    proyecto_id: job.proyecto_id as string,
    tarea_id: (job.tarea_id as string | null) ?? null,
    meta: { render_job_id: job.id, tipo: job.tipo },
  });

  return NextResponse.json({ ok: true, id: job.id });
}
