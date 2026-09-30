import "server-only";
import { resolverEquipo } from "@/lib/produccion-tareas";
import { avanzarEstadoPorTareas } from "@/lib/estado-auto";
import { entregaTrasPalomear, entregaParaQuienPalomeo } from "@/lib/entrega";
import { efectosDeTareaCompletada } from "@/lib/tarea-completar";
import { registrarActividad } from "@/lib/actividad";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * El envío a edición visto por TEMA, para EP y álbum.
 *
 * El motor (manifiesto, subida, revisiones) ya era por clave desde el día uno:
 * `clave = tarea_id` en una canción de EP. Lo que faltaba era todo lo que
 * rodea a la clave: la pantalla, a quién avisar y cerrar el paso de edición.
 */

const TIPOS_ALBUM = ["ep", "album"];
export const esAlbum = (tipo: unknown) => TIPOS_ALBUM.includes(String(tipo ?? ""));

/** El paso de edición se reconoce por el título, igual que hace el resto del
 *  panel: "Editar y cuantizar" en la plantilla, y a veces escrito a mano. */
const ES_EDICION = /cuantiz/i;

export interface EstadoEdicion {
  envios: Record<string, unknown>[];
  revisiones: Record<string, unknown>[];
  total: number;
  subidos: number;
  fallados: number;
  pendientes: number;
  bytesPendientes: number;
  truncado: boolean;
}

/**
 * Cómo va una clave: sus envíos, sus revisiones y cuánto falta.
 *
 * Los conteos se DERIVAN, no se guardan: un contador guardado se desincroniza
 * el primer día que una subida falle a medias, y entonces la barra miente.
 * Devuelve null si las tablas no existen (el SQL lo corre una persona a mano).
 */
export async function estadoDeClave(sb: SB, clave: string): Promise<EstadoEdicion | null> {
  const arch = () => sb.from("edicion_archivos");
  const [envios, total, subidos, fallados, revs, pend] = await Promise.all([
    sb.from("edicion_envios").select("*").eq("clave", clave).order("num", { ascending: false }),
    arch().select("id", { count: "exact", head: true }).eq("clave", clave),
    arch().select("id", { count: "exact", head: true }).eq("clave", clave).not("subido_at", "is", null),
    arch().select("id", { count: "exact", head: true }).eq("clave", clave).is("subido_at", null).gte("intentos", 5),
    sb.from("edicion_revisiones").select("*").eq("clave", clave).order("num", { ascending: false }),
    // El peso sí necesita traer filas. Sólo lo pendiente, que casi siempre son pocas.
    arch().select("bytes").eq("clave", clave).is("subido_at", null).limit(1000),
  ]);
  if (envios.error) return null;

  const filasPend = (pend.data ?? []) as { bytes: number }[];
  return {
    envios: envios.data ?? [],
    revisiones: revs.data ?? [],
    total: total.count ?? 0,
    subidos: subidos.count ?? 0,
    fallados: fallados.count ?? 0,
    pendientes: (total.count ?? 0) - (subidos.count ?? 0),
    bytesPendientes: filasPend.reduce((a, r) => a + Number(r.bytes), 0),
    truncado: filasPend.length >= 1000,
  };
}

interface Subtarea { id: string; tarea_id: string; titulo: string; hecho: boolean; orden: number | null; responsable_id: string | null }

export interface TemaEdicion {
  tareaId: string;
  titulo: string;
  /** Lo que va ANTES de editar en ese tema y sigue sin palomear. */
  falta: string[];
  /** ¿Ya está palomeado "Editar y cuantizar"? null = el tema no tiene ese paso. */
  editado: boolean | null;
}

/**
 * Los temas del disco, en su orden, con lo que les falta para poder editarse.
 *
 * "Lo que falta" son los pasos que van ANTES de "Editar y cuantizar" según el
 * orden de ESE tema — no una lista fija: en TRiP MX "Grabar Voces" va antes de
 * editar en EFÍMERO y después en LA KHABALAH. Es informativo; nunca bloquea el
 * envío, porque a veces se manda a editar lo que hay y lo demás llega después.
 */
export async function temasDelAlbum(sb: SB, proyectoId: string): Promise<TemaEdicion[]> {
  const { data: temas } = await sb.from("proyecto_tareas")
    .select("id, titulo, orden").eq("proyecto_id", proyectoId).eq("es_cancion", true).order("orden");
  const lista = (temas ?? []) as { id: string; titulo: string }[];
  if (!lista.length) return [];

  const { data: subs } = await sb.from("proyecto_subtareas")
    .select("id, tarea_id, titulo, hecho, orden, responsable_id")
    .in("tarea_id", lista.map((t) => t.id));
  const todas = (subs ?? []) as Subtarea[];

  return lista.map((t) => {
    const propias = todas.filter((s) => s.tarea_id === t.id).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const edicion = propias.find((s) => ES_EDICION.test(s.titulo));
    const falta = edicion
      ? propias.filter((s) => (s.orden ?? 0) < (edicion.orden ?? 0) && !s.hecho).map((s) => s.titulo)
      : [];
    return { tareaId: t.id, titulo: t.titulo, falta, editado: edicion ? edicion.hecho : null };
  });
}

/** ¿Esa tarea es una canción de ese proyecto? Todo lo que llega del navegador
 *  con un `tarea_id` pasa por aquí: sin esto, un id de otro proyecto crearía
 *  un envío con la clave de una canción ajena. */
export async function esTemaDe(sb: SB, proyectoId: string, tareaId: string): Promise<boolean> {
  const { data } = await sb.from("proyecto_tareas")
    .select("id").eq("id", tareaId).eq("proyecto_id", proyectoId).eq("es_cancion", true).maybeSingle();
  return Boolean(data);
}

export interface Quien { id: string | null; email: string | null; nombre: string | null }

/**
 * A quién avisar, resuelto AL ENVIAR y congelado en la fila.
 *
 * Si se dedujera al momento del aviso, reasignar la tarea entre el envío y el
 * final de la subida mandaría la notificación a otra persona.
 */
export async function aQuienAvisar(sb: SB, d: { proyectoId: string; tareaId: string | null; elegido?: unknown }): Promise<Quien> {
  const { data: eq } = await sb.from("equipo").select("id, nombre, email");
  const equipo = (eq ?? []) as { id: string; nombre: string; email: string | null }[];
  const porId = (id: string | null): Quien | null => {
    const e = equipo.find((x) => x.id === id);
    return e ? { id: e.id, email: e.email, nombre: e.nombre } : null;
  };

  // 1. Lo que eligió una persona en el diálogo. Gana siempre.
  if (d.elegido) {
    const e = porId(String(d.elegido));
    if (e) return e;
  }

  // 2. En un tema de EP: el responsable de SU subtarea "Editar y cuantizar".
  //    Ahí el paso es subtarea, no tarea, y buscarlo sólo entre las tareas del
  //    proyecto (lo que se hacía antes) nunca lo encontraba.
  if (d.tareaId) {
    const { data: subs } = await sb.from("proyecto_subtareas")
      .select("responsable_id").eq("tarea_id", d.tareaId).ilike("titulo", "%cuantiz%").limit(3);
    for (const s of subs ?? []) {
      const e = porId(s.responsable_id);
      if (e) return e;
    }
  }

  // 3. Quien tenga la tarea de editar y cuantizar en el proyecto.
  const { data: tareas } = await sb.from("proyecto_tareas")
    .select("responsable_id").eq("proyecto_id", d.proyectoId).ilike("titulo", "%cuantiz%").limit(5);
  for (const t of tareas ?? []) {
    const e = porId(t.responsable_id);
    if (e) return e;
  }

  // 4. El alias de siempre — la misma función que puso a esa persona en las
  //    plantillas de tareas desde el principio.
  return porId(resolverEquipo(equipo)("diego")) ?? { id: null, email: null, nombre: null };
}

/**
 * Palomea "Editar y cuantizar" cuando quien edita dice que ya terminó.
 *
 * Lo decide una PERSONA al subir la revisión (decisión del dueño 2026-09-29),
 * nunca la llegada de la revisión sola: una rev-01 puede ser un avance parcial.
 * En un tema de EP se palomea su subtarea; en un beat personalizado, la tarea.
 * Mismos efectos que palomearlo en el tablero (columna, entrega, aviso al
 * cliente) — por eso pasa por las mismas funciones que el portal de músicos.
 *
 * Devuelve lo que quedó palomeado, o null si no había nada pendiente.
 */
export async function palomearEdicion(
  sb: SB,
  d: { proyectoId: string; tareaId: string | null; actor: string },
): Promise<string | null> {
  try {
    if (d.tareaId) {
      const { data: tema } = await sb.from("proyecto_tareas")
        .select("titulo").eq("id", d.tareaId).maybeSingle();
      const { data: subs } = await sb.from("proyecto_subtareas")
        .select("id, titulo").eq("tarea_id", d.tareaId).eq("hecho", false).ilike("titulo", "%cuantiz%").limit(1);
      const sub = (subs ?? [])[0] as { id: string; titulo: string } | undefined;
      if (!sub) return null;
      // `.eq("hecho", false)`: si alguien la palomeó en este instante, no se repiten los efectos.
      const { data: hecha } = await sb.from("proyecto_subtareas")
        .update({ hecho: true }).eq("id", sub.id).eq("hecho", false).select("id");
      if (!hecha?.length) return null;

      await avanzarEstadoPorTareas(sb, d.proyectoId, d.actor);
      await entregaParaQuienPalomeo(sb, await entregaTrasPalomear(sb, { subtareaId: sub.id }));
      const hecho = `${sub.titulo} · ${(tema?.titulo as string | null) ?? "tema"}`;
      await registrarActividad(sb, {
        tipo: "tarea_completada",
        titulo: `“${hecho}” quedó completa al subir la revisión ✅`,
        actor: d.actor,
        proyecto_id: d.proyectoId,
        tarea_id: d.tareaId,
      });
      return hecho;
    }

    const { data: ts } = await sb.from("proyecto_tareas")
      .select("id, titulo, visible_cliente").eq("proyecto_id", d.proyectoId)
      .eq("hecho", false).ilike("titulo", "%cuantiz%").limit(1);
    const t = (ts ?? [])[0] as { id: string; titulo: string; visible_cliente: boolean | null } | undefined;
    if (!t) return null;
    const { data: hecha } = await sb.from("proyecto_tareas")
      .update({ hecho: true, completado_at: new Date().toISOString() })
      .eq("id", t.id).eq("hecho", false).select("id");
    if (!hecha?.length) return null;

    await efectosDeTareaCompletada(sb, {
      tareaId: t.id, proyectoId: d.proyectoId, titulo: t.titulo,
      visibleCliente: t.visible_cliente ?? null, actor: d.actor,
    });
    await registrarActividad(sb, {
      tipo: "tarea_completada",
      titulo: `“${t.titulo}” quedó completa al subir la revisión ✅`,
      actor: d.actor,
      proyecto_id: d.proyectoId,
      tarea_id: t.id,
    });
    return t.titulo;
  } catch (e) {
    // La revisión ya quedó registrada; no palomear no debe tumbar la subida.
    console.error("palomear-edicion:", e);
    return null;
  }
}
