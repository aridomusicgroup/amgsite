import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad } from "@/lib/actividad";
import { avisarMusicoDeRender } from "@/lib/musico-aviso";
import { asignarEnPortal } from "@/lib/musico-asignar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_NOTA = 1000;
const MAX_INSTRUMENTO = 40;

/**
 * Mandarle a otro músico un previo que YA está hecho.
 *
 * En una producción tocan varios músicos y el previo que necesitan es el mismo
 * archivo. Hasta hoy la única forma de mandárselo a un segundo músico era
 * renderizarlo otra vez: diez minutos de la computadora del estudio para
 * producir un mp3 idéntico al que ya está en Drive. Y ni así de fácil —
 * `avisado_en` es un candado que nadie borra nunca, así que un trabajo ya
 * avisado no vuelve a mandar correo jamás.
 *
 * **Un reenvío escribe una fila NUEVA de `render_jobs` apuntando al mismo
 * archivo de Drive.** Parece un rodeo y es lo que hace que funcione:
 *
 *   1. El enlace "Escuchar la pista de referencia" que el músico ve en /musico
 *      sale de `musico-data.ts`, que busca en `render_jobs` por `musico_id` +
 *      `enlace_publico`. Sin fila, el segundo músico se queda sin referencia.
 *   2. `avisado_en` es por fila: una fila nueva es un candado nuevo, sin tocar
 *      el original ni inventar cómo borrar candados.
 *   3. Queda el registro de a quién se le mandó qué y cuándo.
 *
 * Ya hay precedente exacto: `/api/admin/musico-archivos` (PATCH) inserta una
 * fila de `render_jobs` sobre un archivo de Drive que ya existe, sin renderizar.
 *
 * REAPER nunca la va a agarrar: el script sólo reclama trabajos en `pendiente`,
 * y ésta nace en `listo`.
 *
 * Ruta aparte y no un PATCH más en /api/admin/render porque aquélla es para
 * compartir con el CLIENTE, y su guardia rechaza justo estos trabajos.
 *
 * Permiso: `getProduccionEmail`, el mismo que aprobar un previo o compartirlo.
 * Mandarle un previo a un músico es una decisión de producción; prender REAPER
 * en la máquina de otro, no — por eso encolar un render pide otro permiso.
 */
export async function POST(req: NextRequest) {
  const actor = await getProduccionEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const jobId = String(b.jobId || "").trim();
  const musicoId = String(b.musicoId || "").trim();
  const instrumento = String(b.instrumento || "").trim().slice(0, MAX_INSTRUMENTO);
  const nota = String(b.nota || "").trim().slice(0, MAX_NOTA) || null;
  const asignar = b.asignar === true;

  if (!jobId || !musicoId) return NextResponse.json({ error: "Falta el previo o el músico." }, { status: 400 });

  const sb = supabaseAdmin();

  const { data: job } = await sb
    .from("render_jobs")
    .select("id, proyecto_id, tarea_id, tipo, estado, drive_urls, enlace_publico, musico_id, opciones")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: "Ese previo ya no existe." }, { status: 404 });
  // Sólo previos de músico: son los que llevan bpm y tonalidad en el nombre del
  // archivo, que es lo que necesita quien va a grabar encima. Un previo de
  // cliente suena igual pero se llama distinto, y los stems son varios archivos
  // de los que sólo se compartiría el primero.
  if (job.tipo !== "musico") {
    return NextResponse.json({ error: "Sólo se reenvían previos de músico." }, { status: 400 });
  }
  if (job.estado !== "listo") return NextResponse.json({ error: "Ese render todavía no termina." }, { status: 409 });

  const archivos = (job.drive_urls as { archivo: string; id: string; url?: string }[] | null) ?? [];
  if (!archivos.length) return NextResponse.json({ error: "Ese previo no llegó a subirse a Drive." }, { status: 409 });

  if (job.musico_id === musicoId) {
    return NextResponse.json({ error: "Ése es el músico al que ya se le mandó este previo." }, { status: 409 });
  }

  const { data: m } = await sb
    .from("musicos")
    .select("nombre, email, activo, portal_activo")
    .eq("id", musicoId)
    .maybeSingle();
  if (!m || !m.activo) return NextResponse.json({ error: "Ese músico ya no está activo." }, { status: 409 });
  if (!String(m.email || "").trim()) {
    return NextResponse.json(
      { error: `${m.nombre} no tiene correo registrado. Agrégaselo en Ajustes → Músicos.` },
      { status: 409 },
    );
  }
  if (asignar) {
    if (!m.portal_activo) {
      return NextResponse.json(
        { error: `${m.nombre} no tiene el portal prendido. Actívaselo en Ajustes → Músicos o desmarca la casilla.` },
        { status: 409 },
      );
    }
    if (!instrumento) return NextResponse.json({ error: "Dile qué va a grabar, o desmarca lo del portal." }, { status: 400 });
  }

  const { bpm, tonalidad } = await tempoYTono(sb, job);

  const { data: nueva, error } = await sb
    .from("render_jobs")
    .insert({
      proyecto_id: job.proyecto_id,
      tarea_id: job.tarea_id,
      tipo: "musico",
      // Nace terminada: el archivo ya existe. El script sólo reclama
      // `pendiente`, así que nunca la va a tomar para renderizar.
      estado: "listo",
      musico_id: musicoId,
      // El MISMO archivo de Drive, mismo id. Ojo: el día que se implemente
      // `quitarPublico()` —hoy no tiene ni un llamador— revocar el enlace por
      // una de estas filas se lo quita también a la otra.
      drive_urls: archivos,
      enlace_publico: job.enlace_publico ?? null,
      opciones: { bpm, tonalidad, instrumento: instrumento || null, nota, reenvioDe: job.id },
      origen: "reenvio",
      compartir: false,   // esto NUNCA va al cliente
      pedido_por: actor,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const aviso = await avisarMusicoDeRender(sb, nueva.id as string);

  // Va DESPUÉS de avisar y es best-effort: si esto falla, el previo ya salió y
  // la asignación se puede hacer a mano desde la tarea. Pero el resultado se
  // devuelve para poder decirlo en pantalla — que un `false` pase callado es lo
  // que dejó esta misma mitad rota durante semanas.
  let asignado = false;
  if (asignar) {
    asignado = await asignarEnPortal(sb, job.proyecto_id as string, job.tarea_id as string | null, musicoId, instrumento, actor, nota);
  }

  await registrarActividad(sb, {
    tipo: "render_compartido",
    titulo: `Se le reenvió el previo a ${m.nombre}`,
    actor,
    proyecto_id: job.proyecto_id as string,
    tarea_id: job.tarea_id as string | null,
    meta: { musico: m.nombre, instrumento: instrumento || null, reenvioDe: job.id, avisado: aviso.avisado ?? null },
  });

  return NextResponse.json({ ok: true, id: nueva.id, avisado: aviso.avisado ?? null, omitido: aviso.omitido ?? null, asignado });
}

/**
 * El tempo y la tonalidad que van en el correo.
 *
 * Salen de las opciones del render original, que es lo que de verdad se
 * renderizó. Un trabajo viejo puede no traerlas: ahí se caen a la canción y
 * luego al proyecto, que es donde el propio flujo de render las deja guardadas
 * al encolar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tempoYTono(sb: any, job: { proyecto_id: string; tarea_id: string | null; opciones: unknown }) {
  const op = (job.opciones ?? {}) as Record<string, unknown>;
  let bpm = Number(op.bpm) || 0;
  let tonalidad = String(op.tonalidad ?? "").trim();
  if (bpm && tonalidad) return { bpm, tonalidad };

  const fuente = job.tarea_id
    ? await sb.from("proyecto_tareas").select("tonalidad, bpm").eq("id", job.tarea_id).maybeSingle()
    : await sb.from("proyectos").select("tonalidad, bpm").eq("id", job.proyecto_id).maybeSingle();
  bpm = bpm || Number(fuente?.data?.bpm) || 0;
  tonalidad = tonalidad || String(fuente?.data?.tonalidad ?? "").trim();
  return { bpm, tonalidad };
}
