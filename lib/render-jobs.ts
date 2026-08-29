import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Cola de renders de REAPER (ver supabase-render-jobs.sql).
 *
 * El panel solo ENCOLA; quien renderiza es el script local `reaper-sync` que
 * corre en la máquina donde vive REAPER. Por eso aquí no hay nada de rutas de
 * disco: el script resuelve la carpeta igual que cuando la creó.
 */

export const TIPOS_RENDER = ["previo", "entregables", "stems"] as const;
export type TipoRender = (typeof TIPOS_RENDER)[number];

export const TIPO_RENDER_LABEL: Record<TipoRender, string> = {
  previo: "Previo",
  entregables: "Entregables",
  stems: "Stems",
};

/** Etapas en las que todavía tiene sentido pedir un render. */
const ESTADOS_ACTIVOS = ["cola", "produccion", "revision"];
const TIPOS_ALBUM = ["ep", "album"];

export interface RenderJob {
  id: string;
  proyectoId: string;
  tareaId: string | null;
  tipo: TipoRender;
  estado: "pendiente" | "renderizando" | "subiendo" | "listo" | "error";
  previoNum: number | null;
  error: string | null;
  createdAt: string;
}

/** Una cosa renderizable: una producción normal, o una canción de un EP/Álbum. */
export interface Renderizable {
  /** Clave única en la lista — el id de la tarea si es canción, si no el del proyecto. */
  key: string;
  proyectoId: string;
  tareaId: string | null;
  titulo: string;
  /** El álbum al que pertenece, cuando es una canción. */
  album: string | null;
  cliente: string;
  folio: string | null;
  estado: string;
  ultimoPrevio: number;
  jobs: RenderJob[];
}

function mapJob(r: Record<string, unknown>): RenderJob {
  return {
    id: r.id as string,
    proyectoId: r.proyecto_id as string,
    tareaId: (r.tarea_id as string | null) ?? null,
    tipo: r.tipo as TipoRender,
    estado: r.estado as RenderJob["estado"],
    previoNum: r.previo_num === null || r.previo_num === undefined ? null : Number(r.previo_num),
    error: (r.error as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

/**
 * Lo que se puede renderizar hoy: producciones de CLIENTE (con venta ligada)
 * que siguen abiertas. Los beats de catálogo quedan fuera a propósito — no
 * tienen cliente a quien entregarle.
 */
export async function renderizables(): Promise<Renderizable[]> {
  const sb = supabaseAdmin();

  const { data: proyectos } = await sb
    .from("proyectos")
    .select("id, folio, titulo, tipo, estado, contactos(nombre)")
    .eq("clase", "produccion")
    .in("estado", ESTADOS_ACTIVOS)
    .not("venta_id", "is", null)
    .order("created_at", { ascending: false });
  if (!proyectos?.length) return [];

  const ids = proyectos.map((p) => p.id as string);

  // Canciones de los EP/Álbum: cada una es su propio proyecto de REAPER.
  const idsAlbum = proyectos.filter((p) => TIPOS_ALBUM.includes(p.tipo as string)).map((p) => p.id as string);
  const { data: canciones } = idsAlbum.length
    ? await sb
        .from("proyecto_tareas")
        .select("id, proyecto_id, titulo, orden")
        .in("proyecto_id", idsAlbum)
        .eq("es_cancion", true)
        .order("orden", { ascending: true })
    : { data: [] };

  const { data: jobsRaw } = await sb
    .from("render_jobs")
    .select("*")
    .in("proyecto_id", ids)
    .order("created_at", { ascending: false });
  const jobs = (jobsRaw ?? []).map(mapJob);

  const porClave = (proyectoId: string, tareaId: string | null) =>
    jobs.filter((j) => j.proyectoId === proyectoId && j.tareaId === tareaId);

  const out: Renderizable[] = [];
  for (const p of proyectos) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = ((p.contactos as any)?.nombre as string | null) ?? "—";
    const esAlbum = TIPOS_ALBUM.includes(p.tipo as string);
    const propias = (canciones ?? []).filter((c) => c.proyecto_id === p.id);

    // Un EP/Álbum no se renderiza como tal: lo que se renderiza son sus canciones.
    if (esAlbum) {
      for (const c of propias) {
        const js = porClave(p.id as string, c.id as string);
        out.push({
          key: c.id as string,
          proyectoId: p.id as string,
          tareaId: c.id as string,
          titulo: c.titulo as string,
          album: p.titulo as string,
          cliente,
          folio: (p.folio as string | null) ?? null,
          estado: p.estado as string,
          ultimoPrevio: Math.max(0, ...js.filter((j) => j.tipo === "previo" && j.previoNum).map((j) => j.previoNum!)),
          jobs: js,
        });
      }
      continue;
    }

    const js = porClave(p.id as string, null);
    out.push({
      key: p.id as string,
      proyectoId: p.id as string,
      tareaId: null,
      titulo: p.titulo as string,
      album: null,
      cliente,
      folio: (p.folio as string | null) ?? null,
      estado: p.estado as string,
      ultimoPrevio: Math.max(0, ...js.filter((j) => j.tipo === "previo" && j.previoNum).map((j) => j.previoNum!)),
      jobs: js,
    });
  }
  return out;
}

/**
 * Encola un render. Devuelve el id del trabajo, o un mensaje de por qué no.
 *
 * Rechaza si ya hay uno del mismo tipo en vuelo para lo mismo: dos renders
 * simultáneos del mismo proyecto se pisarían el archivo de salida.
 */
export async function encolarRender(
  proyectoId: string,
  tareaId: string | null,
  tipo: TipoRender,
  pedidoPor: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const sb = supabaseAdmin();

  let enVuelo = sb
    .from("render_jobs")
    .select("id")
    .eq("proyecto_id", proyectoId)
    .eq("tipo", tipo)
    .in("estado", ["pendiente", "renderizando", "subiendo"]);
  enVuelo = tareaId ? enVuelo.eq("tarea_id", tareaId) : enVuelo.is("tarea_id", null);
  const { data: yaHay } = await enVuelo.limit(1);
  if (yaHay?.length) return { ok: false, error: "Ya hay un render de ese tipo en curso." };

  let previoNum: number | null = null;
  if (tipo === "previo") {
    let q = sb
      .from("render_jobs")
      .select("previo_num")
      .eq("proyecto_id", proyectoId)
      .eq("tipo", "previo")
      .not("previo_num", "is", null)
      .order("previo_num", { ascending: false });
    q = tareaId ? q.eq("tarea_id", tareaId) : q.is("tarea_id", null);
    const { data: ultimo } = await q.limit(1);
    previoNum = (Number(ultimo?.[0]?.previo_num) || 0) + 1;
  }

  const { data, error } = await sb
    .from("render_jobs")
    .insert({ proyecto_id: proyectoId, tarea_id: tareaId, tipo, previo_num: previoNum, pedido_por: pedidoPor })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}
