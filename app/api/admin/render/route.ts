import { NextRequest, NextResponse } from "next/server";
import { moduloPermitido, getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encolarRender, TIPOS_RENDER, type TipoRender } from "@/lib/render-jobs";
import { avisarClienteDeRender } from "@/lib/render-aviso";
import { registrarActividad } from "@/lib/actividad";
import { asignarEnPortal } from "@/lib/musico-asignar";
import { leerOpciones } from "@/lib/render-opciones";
import { finiquitadoProyecto } from "@/lib/entrega";

export const dynamic = "force-dynamic";


/** Encola un render de REAPER. Solo el desarrollador — dispara trabajo en su máquina. */
export async function POST(req: NextRequest) {
  const email = await moduloPermitido("/admin/dev-logs");
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyectoId || "").trim();
  const tareaId = b.tareaId ? String(b.tareaId).trim() : null;
  const tipo = String(b.tipo || "") as TipoRender;

  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });
  if (!TIPOS_RENDER.includes(tipo)) return NextResponse.json({ error: "Tipo de render inválido." }, { status: 400 });

  const op = leerOpciones(b.opciones);
  if (!op.ok) return NextResponse.json({ error: op.error }, { status: 400 });

  // El previo de músico lleva bpm y tonalidad EN EL NOMBRE DEL ARCHIVO: es lo
  // que necesita quien va a grabar encima. Sin eso el render no tiene sentido,
  // así que se exige aquí y no sólo en el formulario.
  if (tipo === "musico") {
    const o = op.op;
    if (!o?.musicoId) return NextResponse.json({ error: "Elige a qué músico se le manda." }, { status: 400 });
    if (!o.bpm || !Number.isFinite(o.bpm) || o.bpm < 20 || o.bpm > 400) {
      return NextResponse.json({ error: "El BPM tiene que ser un número entre 20 y 400." }, { status: 400 });
    }
    if (!o.tonalidad || o.tonalidad.length > 12) {
      return NextResponse.json({ error: "Pon la tonalidad (ej. Am, F#, D)." }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { data: m } = await sb.from("musicos").select("email, portal_activo").eq("id", o.musicoId).maybeSingle();
    if (!m) return NextResponse.json({ error: "Ese músico ya no existe." }, { status: 409 });
    if (!String(m.email || "").trim()) {
      return NextResponse.json({ error: "Ese músico no tiene correo registrado. Agrégaselo en Ajustes." }, { status: 409 });
    }
    if (o.asignar) {
      if (!m.portal_activo) {
        return NextResponse.json({ error: "Ese músico no tiene el portal prendido. Actívaselo en Ajustes → Músicos o desmarca la casilla." }, { status: 409 });
      }
      if (!String(o.instrumento || "").trim()) {
        return NextResponse.json({ error: "Dile qué va a grabar, o desmarca lo del portal." }, { status: 400 });
      }
    }
  } else if (op.op?.musicoId || op.op?.bpm || op.op?.tonalidad || op.op?.asignar || op.op?.instrumento) {
    return NextResponse.json({ error: "Músico, BPM y tonalidad sólo aplican al previo de músico." }, { status: 400 });
  }
  // Elegir pistas sólo tiene sentido en stems; en otro tipo sería una elección
  // silenciosamente ignorada.
  if (tipo !== "stems" && op.op?.pistas) {
    return NextResponse.json({ error: "Sólo los stems permiten elegir pistas." }, { status: 400 });
  }

  const r = await encolarRender(proyectoId, tareaId, tipo, email, op.op);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });

  // Se guardan en el proyecto para no volver a pedirlos: la próxima vez llegan
  // puestos. En un EP van en la canción, no en el álbum — cada tema tiene su
  // propia tonalidad. Best-effort: si falla, el render igual ya está encolado.
  if (tipo === "musico" && op.op?.tonalidad) {
    const sb = supabaseAdmin();
    const patch = { tonalidad: op.op.tonalidad, bpm: op.op.bpm ?? null };
    const q = tareaId
      ? sb.from("proyecto_tareas").update(patch).eq("id", tareaId)
      : sb.from("proyectos").update(patch).eq("id", proyectoId);
    await q;
  }

  // Habilitarle el trabajo en su portal. Va DESPUÉS de encolar y es
  // best-effort: si esto falla, el previo igual ya salió y la asignación se
  // puede hacer a mano desde la tarea.
  let asignado = false;
  if (tipo === "musico" && op.op?.asignar && op.op.musicoId) {
    asignado = await asignarEnPortal(supabaseAdmin(), proyectoId, tareaId, op.op.musicoId, String(op.op.instrumento || "").trim(), email);
  }

  return NextResponse.json({ ok: true, id: r.id, asignado });
}

/**
 * PATCH: compartir con el cliente un render que YA terminó.
 *
 * Hace falta desde que la casilla "Avisar al cliente" dejó de venir palomeada.
 * Antes la decisión se tomaba al lanzar el render y ya no había vuelta: un
 * previo que salía sin marcar se quedaba interno para siempre, y la única
 * salida era volver a renderizarlo.
 *
 * Solo enciende `compartir`; nunca lo apaga. Quitarle al cliente un archivo que
 * ya escuchó no se arregla con un booleano —le quedó el correo y quizá la
 * descarga— y merece una conversación, no un botón.
 *
 * Permiso: el mismo que aprobar el previo de un músico (`getProduccionEmail`),
 * no el del desarrollador que dispara renders. Compartir es una decisión de
 * producción; encender REAPER en una máquina ajena, no.
 */
export async function PATCH(req: NextRequest) {
  const actor = await getProduccionEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el render." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: job } = await sb
    .from("render_jobs")
    .select("id, proyecto_id, tarea_id, tipo, estado, compartir, avisado_en, drive_urls, musico_id")
    .eq("id", id)
    .maybeSingle();
  if (!job) return NextResponse.json({ error: "Ese render ya no existe." }, { status: 404 });
  if (job.estado !== "listo") {
    return NextResponse.json({ error: "Ese render todavía no termina." }, { status: 409 });
  }
  // Sin archivos en Drive el cliente no tendría qué abrir: pasa cuando la subida
  // falló y el mp3 se quedó solo en el disco de la máquina con REAPER.
  if (!((job.drive_urls as unknown[] | null) ?? []).length) {
    return NextResponse.json({ error: "Ese render no llegó a subirse a Drive. Vuelve a lanzarlo." }, { status: 409 });
  }
  // Un previo de músico va por enlace público a OTRA persona; compartirlo con el
  // cliente se hace aprobándolo en la pestaña Músicos, que además deja rastro.
  if (job.musico_id) {
    return NextResponse.json({ error: "Ese es un previo de músico: compártelo desde la sección Músicos." }, { status: 400 });
  }
  if (job.compartir && job.avisado_en) return NextResponse.json({ ok: true, yaEstaba: true });

  if (!job.compartir) {
    const { error } = await sb.from("render_jobs").update({ compartir: true }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Los archivos finales sólo los ve el cliente cuando liquida: el panel del
  // cliente los esconde mientras deba. Compartirlos aquí queda apuntado, pero
  // mandarle "ya están tus archivos" a alguien que no los puede abrir es peor
  // que no avisar. El correo sale solo en cuanto pague (`liberarEntregas`).
  if ((job.tipo === "entregables" || job.tipo === "stems") && !(await finiquitadoProyecto(sb, job.proyecto_id as string))) {
    return NextResponse.json({ ok: true, retenido: true, omitido: "se le mostrará en cuanto liquide el saldo" });
  }

  await registrarActividad(sb, {
    tipo: "render_compartido",
    titulo: `Se compartió con el cliente el ${job.tipo} de la producción`,
    actor,
    proyecto_id: job.proyecto_id as string,
    tarea_id: (job.tarea_id as string | null) ?? null,
    meta: { render_job_id: id, tipo: job.tipo },
  });

  const r = await avisarClienteDeRender(sb, id);
  return NextResponse.json({ ok: true, avisado: r.avisado ?? null, omitido: r.omitido ?? null });
}
