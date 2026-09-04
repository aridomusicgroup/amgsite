import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Cola de renders de REAPER (ver supabase-render-jobs.sql).
 *
 * El panel solo ENCOLA; quien renderiza es el script local `reaper-sync` que
 * corre en la máquina donde vive REAPER. Por eso aquí no hay nada de rutas de
 * disco: el script resuelve la carpeta igual que cuando la creó.
 */

export const TIPOS_RENDER = ["previo", "entregables", "stems", "musico"] as const;
export type TipoRender = (typeof TIPOS_RENDER)[number];

export const TIPO_RENDER_LABEL: Record<TipoRender, string> = {
  previo: "Previo",
  entregables: "Entregables",
  stems: "Stems",
  musico: "Previo músico",
};

/** Etapas en las que todavía tiene sentido pedir un render. */
const ESTADOS_ACTIVOS = ["cola", "produccion", "revision"];
const TIPOS_ALBUM = ["ep", "album"];

/** Una pista del .rpp, tal como la publica el script local. */
export interface PistaRpp {
  nombre: string;
  /** Si el script la exportaría por su cuenta (regla automática). */
  esStem: boolean;
  silenciada: boolean;
  /** Nivel de anidamiento, para dibujar los grupos. */
  profundidad: number;
}

export interface MarcadorRpp {
  nombre: string;
  seg: number;
}

/** Selección de tiempo guardada. `valida` es false si viene en cero o invertida. */
export interface SeleccionRpp {
  inicio: number;
  fin: number;
  valida: boolean;
}

export interface ArchivoRpp {
  archivo: string;
  mtime: number;
  bytes: number;
  /** Items de audio. Cero = el proyecto sigue siendo la plantilla sin tocar y
   *  no hay nada que renderizar. `undefined` en filas de antes de este dato. */
  items?: number;
  /** Tempo del proyecto (línea TEMPO del .rpp). Dato duro. */
  bpm?: number | null;
  /** Tonalidad ADIVINADA de cómo están nombrados los archivos de la carpeta —
   *  REAPER no la guarda. Es una sugerencia, no un dato. */
  tonalidad?: string | null;
  marcadores: MarcadorRpp[];
  seleccion: SeleccionRpp | null;
  pistas: PistaRpp[];
  error: string | null;
}

/** Lo que hay dentro de la carpeta del proyecto, según el último escaneo. */
export interface Inventario {
  carpeta: string | null;
  /** Los .rpp, del más reciente al más viejo. */
  proyectos: ArchivoRpp[];
  error: string | null;
  escaneadoEn: string;
}

/** Lo que el usuario eligió en el cuadro de opciones. Todo es opcional: sin
 *  nada, el script hace lo de siempre (último .rpp, proyecto completo). */
export interface OpcionesRender {
  rpp?: string;
  rango?: { inicio: number; fin: number } | null;
  pistas?: string[] | null;
  /** Avisar al cliente y mostrarle el archivo en /cuenta cuando quede listo. */
  avisar?: boolean;
  /** Sólo en 'musico': a quién se le manda, y los datos que van en el nombre
   *  del archivo. El músico los necesita para ensayar, así que son obligatorios. */
  musicoId?: string;
  bpm?: number;
  tonalidad?: string;
  /**
   * Además del correo con el previo, dejarle el trabajo en su portal.
   *
   * Son dos cosas que parecen una: mandarle el previo NO le habilita nada en
   * /musico — eso lo hace la asignación. Se juntaron aquí porque en la cabeza
   * de quien lo usa "ya le compartí el previo" significa "ya puede subirme sus
   * pistas", y separarlas dejaba al músico mirando un portal vacío.
   */
  asignar?: boolean;
  instrumento?: string;
}

/** Un músico de sesión al que se le puede mandar un previo. */
export interface MusicoLite {
  id: string;
  nombre: string;
  email: string | null;
  instrumentos: string[];
}

/** Un archivo ya subido a Drive por el script local. */
export interface ArchivoDrive {
  archivo: string;
  id: string;
  url: string;
}

export interface RenderJob {
  id: string;
  proyectoId: string;
  tareaId: string | null;
  tipo: TipoRender;
  estado: "pendiente" | "renderizando" | "subiendo" | "listo" | "error";
  previoNum: number | null;
  error: string | null;
  createdAt: string;
  /** Null si Drive no está conectado o la subida falló (los archivos siguen en disco). */
  driveUrls: ArchivoDrive[] | null;
  /** Sólo en 'musico': el enlace público que se le mandó. */
  enlacePublico: string | null;
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
  /** Si tiene pedido ligado y correo: sin esto el aviso al cliente no puede salir. */
  puedeAvisar: boolean;
  ultimoPrevio: number;
  /** Tonalidad y BPM guardados al crear la venta/proyecto. En un EP son los de
   *  la canción, no los del álbum. Null = nunca se capturaron. */
  tonalidad: string | null;
  bpm: number | null;
  jobs: RenderJob[];
  /** Null mientras el script local no haya escaneado la carpeta todavía. */
  inventario: Inventario | null;
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
    driveUrls: (r.drive_urls as ArchivoDrive[] | null) ?? null,
    enlacePublico: (r.enlace_publico as string | null) ?? null,
  };
}

/**
 * Lo que se puede renderizar hoy: producciones de CLIENTE (con venta ligada)
 * que siguen abiertas. Los beats de catálogo quedan fuera a propósito — no
 * tienen cliente a quien entregarle.
 */
type Fila = Record<string, unknown>;

export async function renderizables(): Promise<Renderizable[]> {
  const sb = supabaseAdmin();

  // `tonalidad` y `bpm` son columnas nuevas: si la migración todavía no se
  // corrió, pedirlas hace fallar la consulta ENTERA y el panel se queda sin un
  // solo proyecto. Ya pasó. Por eso se reintenta sin ellas: mejor la lista
  // completa sin dos datos que una pantalla vacía.
  const consultaProyectos = (cols: string) =>
    sb
      .from("proyectos")
      .select(cols)
      .eq("clase", "produccion")
      .in("estado", ESTADOS_ACTIVOS)
      .not("venta_id", "is", null)
      .order("created_at", { ascending: false });

  // El `select` dinámico apaga la inferencia de tipos de supabase-js, así que
  // las filas se manejan como registros sueltos (igual que ya se hacía abajo).
  let proyectos = (await consultaProyectos(
    "id, folio, titulo, tipo, estado, order_id, tonalidad, bpm, contactos(nombre, email)",
  )).data as Fila[] | null;
  if (!proyectos) {
    proyectos = (await consultaProyectos("id, folio, titulo, tipo, estado, order_id, contactos(nombre, email)"))
      .data as Fila[] | null;
  }
  if (!proyectos?.length) return [];

  const ids = proyectos.map((p) => p.id as string);

  // Canciones de los EP/Álbum: cada una es su propio proyecto de REAPER.
  const idsAlbum = proyectos.filter((p) => TIPOS_ALBUM.includes(p.tipo as string)).map((p) => p.id as string);
  const consultaCanciones = (cols: string) =>
    sb
      .from("proyecto_tareas")
      .select(cols)
      .in("proyecto_id", idsAlbum)
      .eq("es_cancion", true)
      .order("orden", { ascending: true });

  let canciones: Fila[] | null = [];
  if (idsAlbum.length) {
    canciones = (await consultaCanciones("id, proyecto_id, titulo, orden, tonalidad, bpm")).data as Fila[] | null;
    // Mismo reintento que arriba: sin la migración, un EP perdería sus canciones.
    if (!canciones) canciones = (await consultaCanciones("id, proyecto_id, titulo, orden")).data as Fila[] | null;
  }

  const { data: jobsRaw } = await sb
    .from("render_jobs")
    .select("*")
    .in("proyecto_id", ids)
    .order("created_at", { ascending: false });
  const jobs = (jobsRaw ?? []).map(mapJob);

  // Qué hay en cada carpeta del disco, según el último escaneo del script local.
  const { data: invRaw } = await sb.from("render_inventario").select("*").in("proyecto_id", ids);
  const inventarios = new Map<string, Inventario>();
  for (const r of invRaw ?? []) {
    inventarios.set(r.clave as string, {
      carpeta: (r.carpeta as string | null) ?? null,
      proyectos: (r.proyectos as ArchivoRpp[] | null) ?? [],
      error: (r.error as string | null) ?? null,
      escaneadoEn: r.escaneado_en as string,
    });
  }

  const porClave = (proyectoId: string, tareaId: string | null) =>
    jobs.filter((j) => j.proyectoId === proyectoId && j.tareaId === tareaId);

  const out: Renderizable[] = [];
  for (const p of proyectos) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = ((p.contactos as any)?.nombre as string | null) ?? "—";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puedeAvisar = Boolean(p.order_id && ((p.contactos as any)?.email as string | null)?.trim());
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
          puedeAvisar,
          tonalidad: (c.tonalidad as string | null) ?? null,
          bpm: c.bpm == null ? null : Number(c.bpm),
          ultimoPrevio: Math.max(0, ...js.filter((j) => j.tipo === "previo" && j.previoNum).map((j) => j.previoNum!)),
          jobs: js,
          inventario: inventarios.get(c.id as string) ?? null,
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
      puedeAvisar,
      tonalidad: (p.tonalidad as string | null) ?? null,
      bpm: p.bpm == null ? null : Number(p.bpm),
      ultimoPrevio: Math.max(0, ...js.filter((j) => j.tipo === "previo" && j.previoNum).map((j) => j.previoNum!)),
      jobs: js,
      inventario: inventarios.get(p.id as string) ?? null,
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
  opciones: OpcionesRender | null = null,
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
    .insert({
      proyecto_id: proyectoId, tarea_id: tareaId, tipo,
      previo_num: previoNum, pedido_por: pedidoPor,
      opciones: opciones && Object.keys(opciones).length ? opciones : null,
      compartir: opciones?.avisar === true,
      musico_id: opciones?.musicoId ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}

/** Los músicos activos, para elegir a quién mandarle un previo. */
export async function musicosParaPrevio(): Promise<MusicoLite[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("musicos")
    .select("id, nombre, email, instrumentos")
    .eq("activo", true)
    .order("nombre", { ascending: true });
  return (data ?? []).map((m) => ({
    id: m.id as string,
    nombre: m.nombre as string,
    email: (m.email as string | null) ?? null,
    instrumentos: (m.instrumentos as string[] | null) ?? [],
  }));
}
