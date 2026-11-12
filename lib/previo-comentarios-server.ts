import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminEmails, crmEmails } from "@/lib/supabase/auth-server";
import { registrarActividad } from "@/lib/actividad";
import { pushAEmails, destinoTarea, conProyecto } from "@/lib/push";
import {
  tituloDeTarea, formatoMinuto, MARCA_PEDIDO, type ComentarioPrevio,
} from "@/lib/previo-comentarios";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

type Fila = {
  id: string; proyecto_id: string; job_id: string | null; previo_num: number | null; tema_id: string | null;
  tarea_id: string | null; texto: string; segundo: number | null; created_at: string;
};

const COLUMNAS = "id, proyecto_id, job_id, previo_num, tema_id, tarea_id, texto, segundo, created_at";

/**
 * Los comentarios de un proyecto, del más nuevo al más viejo, con "atendido"
 * sacado de la tarea que nació de cada uno (no se duplica en la tabla: si la
 * palomean, el cliente lo ve atendido sin que nadie tenga que acordarse).
 *
 * `disponible: false` = la tabla todavía no existe (SQL sin correr). Quien
 * llama decide qué hacer: el panel del cliente esconde la caja, el del equipo
 * no pinta el histórico. Nunca lanza.
 */
export async function comentariosDeProyecto(
  sb: SB, proyectoId: string,
): Promise<{ disponible: boolean; comentarios: ComentarioPrevio[] }> {
  try {
    const { data, error } = await sb
      .from("previo_comentarios").select(COLUMNAS)
      .eq("proyecto_id", proyectoId).order("created_at", { ascending: false }).limit(300);
    if (error) return { disponible: false, comentarios: [] };
    return { disponible: true, comentarios: await armar(sb, (data ?? []) as Fila[]) };
  } catch {
    return { disponible: false, comentarios: [] };
  }
}

/** Los comentarios que dieron origen a UNA tarea (la ventana de la tarea los muestra). */
export async function comentariosDeTarea(sb: SB, tareaId: string): Promise<ComentarioPrevio[]> {
  try {
    const { data, error } = await sb
      .from("previo_comentarios").select(COLUMNAS)
      .eq("tarea_id", tareaId).order("created_at", { ascending: true });
    if (error) return [];
    return await armar(sb, (data ?? []) as Fila[]);
  } catch {
    return [];
  }
}

async function armar(sb: SB, filas: Fila[]): Promise<ComentarioPrevio[]> {
  if (!filas.length) return [];
  const ids = [...new Set(filas.flatMap((f) => [f.tarea_id, f.tema_id]).filter((x): x is string => Boolean(x)))];
  const tareas = new Map<string, { titulo: string; hecho: boolean }>();
  if (ids.length) {
    const { data } = await sb.from("proyecto_tareas").select("id, titulo, hecho").in("id", ids);
    for (const t of (data ?? []) as { id: string; titulo: string; hecho: boolean }[]) tareas.set(t.id, { titulo: t.titulo, hecho: t.hecho });
  }
  return filas.map((f) => ({
    id: f.id,
    proyectoId: f.proyecto_id,
    jobId: f.job_id,
    previoNum: f.previo_num,
    tema: f.tema_id ? tareas.get(f.tema_id)?.titulo ?? null : null,
    tareaId: f.tarea_id,
    texto: f.texto,
    segundo: f.segundo,
    creadoAt: f.created_at,
    atendido: f.tarea_id ? tareas.get(f.tarea_id)?.hecho === true : false,
  }));
}

/** Quién se hace cargo de los cambios: el responsable de "Mezclar", que es quien los aplica. */
async function responsableDeCambios(sb: SB, proyectoId: string, temaId: string | null): Promise<string | null> {
  const { data: tareas } = await sb
    .from("proyecto_tareas").select("id, titulo, responsable_id").eq("proyecto_id", proyectoId).ilike("titulo", "mezclar%");
  const enTareas = ((tareas ?? []) as { responsable_id: string | null }[]).find((t) => t.responsable_id)?.responsable_id;
  if (enTareas) return enTareas;
  // En un EP "Mezclar" es un paso (subtarea) de cada tema.
  if (temaId) {
    const { data: subs } = await sb
      .from("proyecto_subtareas").select("responsable_id").eq("tarea_id", temaId).ilike("titulo", "mezclar%");
    return ((subs ?? []) as { responsable_id: string | null }[]).find((s) => s.responsable_id)?.responsable_id ?? null;
  }
  return null;
}

export type ResultadoComentario =
  | { ok: true; comentario: ComentarioPrevio; repetido: boolean }
  | { ok: false; status: number; error: string };

const fechaCorta = (d: Date) =>
  d.toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });

/**
 * Registra un comentario del cliente sobre un previo y lo convierte en tarea.
 *
 * El previo tiene que ser de SU proyecto, estar listo y haberse compartido con
 * él: el id llega del navegador y no se confía en él.
 *
 * Orden: primero la tarea, luego el comentario. Si el comentario no se puede
 * guardar se borra la tarea, para no dejar una petición del cliente sin su
 * histórico (ni al revés).
 */
export async function registrarComentarioDePrevio(d: {
  proyectoId: string; proyectoTitulo: string | null; email: string;
  jobId: string; texto: string; segundo: number | null;
}): Promise<ResultadoComentario> {
  const sb = supabaseAdmin();

  const { data: job } = await sb
    .from("render_jobs").select("id, tipo, estado, compartir, previo_num, tarea_id")
    .eq("id", d.jobId).eq("proyecto_id", d.proyectoId).maybeSingle();
  if (!job || job.tipo !== "previo" || job.estado !== "listo" || job.compartir !== true) {
    return { ok: false, status: 404, error: "Ese previo ya no está disponible." };
  }
  const temaId = (job.tarea_id as string | null) ?? null;
  const previoNum = job.previo_num == null ? null : Number(job.previo_num);

  // ¿La tabla existe? Antes de crear nada: una tarea sin histórico no se deja nacer.
  const sonda = await sb.from("previo_comentarios").select("id").limit(1);
  if (sonda.error) return { ok: false, status: 503, error: "Los comentarios todavía no están disponibles. Escríbenos por WhatsApp." };

  // Doble clic o reintento: el mismo texto sobre el mismo previo en los últimos 2 minutos es el mismo comentario.
  const hace2min = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: igual } = await sb
    .from("previo_comentarios").select(COLUMNAS)
    .eq("job_id", d.jobId).eq("autor_email", d.email).eq("texto", d.texto).gte("created_at", hace2min).limit(1);
  if (igual?.length) {
    const [c] = await armar(sb, igual as Fila[]);
    return { ok: true, comentario: c, repetido: true };
  }

  let tema: string | null = null;
  if (temaId) {
    const { data: t } = await sb.from("proyecto_tareas").select("titulo").eq("id", temaId).maybeSingle();
    tema = (t?.titulo as string | null) ?? null;
  }

  // Misma regla que al agregar una tarea a mano: en revisión, pertenece a la ronda en curso.
  const [{ data: ult }, { data: proy }, responsableId] = await Promise.all([
    sb.from("proyecto_tareas").select("orden").eq("proyecto_id", d.proyectoId).order("orden", { ascending: false }).limit(1),
    sb.from("proyectos").select("estado, revision_actual").eq("id", d.proyectoId).maybeSingle(),
    responsableDeCambios(sb, d.proyectoId, temaId),
  ]);
  const revision = proy?.estado === "revision" ? Number(proy?.revision_actual) || 0 : 0;

  const cuando = fechaCorta(new Date());
  const encabezado = [
    MARCA_PEDIDO,
    previoNum && previoNum > 1 ? `Previo ${previoNum}` : "Previo",
    tema,
    d.segundo !== null ? `minuto ${formatoMinuto(d.segundo)}` : null,
    cuando,
  ].filter(Boolean).join(" · ");

  const { data: tarea, error: errTarea } = await sb.from("proyecto_tareas").insert({
    proyecto_id: d.proyectoId,
    titulo: tituloDeTarea({ texto: d.texto, previoNum, tema }),
    responsable_id: responsableId,
    fecha: null,
    hecho: false,
    orden: (Number(ult?.[0]?.orden) || 0) + 1,
    revision,
    notas: `${encabezado}\n\n${d.texto}`,
    // Es trabajo interno: el cliente ya ve su comentario aparte, y una tarea
    // más en su barra de avance le movería el porcentaje sin que nada cambiara.
    visible_cliente: false,
  }).select("id").single();
  if (errTarea || !tarea) {
    console.error("[comentario-previo] no se pudo crear la tarea:", errTarea?.message);
    return { ok: false, status: 500, error: "No pudimos guardar tu comentario. Escríbenos por WhatsApp." };
  }

  const { data: fila, error: errCom } = await sb.from("previo_comentarios").insert({
    proyecto_id: d.proyectoId, job_id: d.jobId, previo_num: previoNum, tema_id: temaId,
    tarea_id: tarea.id, texto: d.texto, segundo: d.segundo, autor_email: d.email,
  }).select(COLUMNAS).single();
  if (errCom || !fila) {
    console.error("[comentario-previo] no se pudo guardar el histórico:", errCom?.message);
    await sb.from("proyecto_tareas").delete().eq("id", tarea.id);
    return { ok: false, status: 500, error: "No pudimos guardar tu comentario. Escríbenos por WhatsApp." };
  }

  await avisarAlEstudio(sb, { ...d, tareaId: tarea.id as string, responsableId, previoNum, tema });
  const [comentario] = await armar(sb, [fila as Fila]);
  return { ok: true, comentario, repetido: false };
}

/** Aviso al equipo y línea en la bitácora. Nunca tumba el comentario. */
async function avisarAlEstudio(sb: SB, d: {
  proyectoId: string; proyectoTitulo: string | null; email: string; texto: string; segundo: number | null;
  tareaId: string; responsableId: string | null; previoNum: number | null; tema: string | null;
}) {
  try {
    let correoResp: string | null = null;
    if (d.responsableId) {
      const { data: eq } = await sb.from("equipo").select("email").eq("id", d.responsableId).maybeSingle();
      correoResp = (eq?.email as string | null) ?? null;
    }
    const titulo = tituloDeTarea({ texto: d.texto, previoNum: d.previoNum, tema: d.tema });
    // Una sola lista: con dos envíos, un admin que además es responsable lo recibiría doble.
    await pushAEmails(sb, [correoResp, ...adminEmails(), ...crmEmails()], {
      titulo: "💬 El cliente comentó su previo",
      cuerpo: conProyecto(d.proyectoTitulo, d.texto.length > 120 ? `${d.texto.slice(0, 117)}…` : d.texto),
      url: destinoTarea(d.tareaId),
    });
    await registrarActividad(sb, {
      tipo: "comentario_previo",
      titulo: `El cliente pidió un cambio: “${titulo}”`,
      actor: d.email,
      proyecto_id: d.proyectoId,
      tarea_id: d.tareaId,
      meta: { previo: d.previoNum, tema: d.tema, segundo: d.segundo },
    });
  } catch (e) {
    console.error("[comentario-previo] aviso:", e);
  }
}
