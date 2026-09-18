import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  leerConfig, validarMarcadores, validarRecursos, validarRubrica,
  type ConfigCurso, type Cta, type Etiqueta, type EstadoProduccion, type Marcador, type Recurso, type Ruta,
  type TipoCurso, type TipoLeccion, type Venta,
} from "@/lib/cursos-tipos";
import { contarFundadores, listaAvisame, ventaDeCurso } from "@/lib/curso-preventa";

/**
 * Capa de datos de Cursos para el ADMIN (autoría + accesos + entregas). El
 * panel de cliente tiene su propia capa (lib/cursos-cliente.ts) — más
 * angosta, por correo, sin exponer nada de edición.
 */

export interface CursoAdmin {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  portadaUrl: string | null;
  precioMxn: number | null;
  activo: boolean;
  driveFolderId: string | null;
  tipo: TipoCurso;
  numModulos: number;
  numLecciones: number;
  numAlumnos: number;
}

export interface CursoLeccion {
  id: string;
  titulo: string;
  tipo: TipoLeccion;
  driveFileId: string | null;
  urlExterna: string | null;
  duracionSeg: number | null;
  orden: number;
  etiqueta: Etiqueta;
  opcional: boolean;
  preview: boolean;
  publicada: boolean;
  cta: Cta;
  contenido: Record<string, unknown>;
  marcadores: Marcador[];
  recursos: Recurso[];
  estadoProduccion: EstadoProduccion;
}

export interface CursoModulo {
  id: string;
  titulo: string;
  orden: number;
  ruta: Ruta;
  descripcion: string | null;
  lecciones: CursoLeccion[];
}

export interface CursoAcceso {
  id: string;
  email: string;
  origen: "manual" | "venta" | "regalo";
  otorgadoPor: string | null;
  createdAt: string;
  venceEn: string | null;
}

export interface CursoDetalle extends CursoAdmin {
  config: ConfigCurso;
  revisionesIncluidas: number;
  modulos: CursoModulo[];
  accesos: CursoAcceso[];
  /** Personas en la lista de espera de la mentoría (desde los llamados). */
  interesados: number;
  entregasPendientes: number;
  /** Cursos de tipo mentoría, para ligarla desde la cabecera. */
  mentorias: { id: string; titulo: string }[];
  /** Estado de venta y precio vigente (misma regla que la página pública). */
  venta: Venta;
  /** Lugares vendidos (accesos por venta). */
  fundadores: number;
  /** Correos de la lista Avísame de la página de venta. */
  avisame: string[];
  /** Lecciones de las que ya se mandó el correo de estreno. */
  estrenosAvisados: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

/** Lista de cursos para la pantalla de autoría, con conteos. */
export async function getCursosAdmin(): Promise<CursoAdmin[]> {
  try {
    const sb = supabaseAdmin();
    const COLS = "id, slug, titulo, descripcion, portada_url, precio_mxn, activo, drive_folder_id";
    const r1 = await sb.from("cursos").select(`${COLS}, tipo`).order("created_at", { ascending: false });
    // Sin la columna `tipo` (SQL v2 sin correr) se pide lo de siempre.
    const cursos: Row[] | null = r1.error
      ? (await sb.from("cursos").select(COLS).order("created_at", { ascending: false })).data
      : r1.data;
    if (!cursos?.length) return [];

    const ids = cursos.map((c: Row) => c.id as string);
    const [{ data: modulos }, { data: lecciones }, { data: accesos }] = await Promise.all([
      sb.from("curso_modulos").select("id, curso_id").in("curso_id", ids),
      sb.from("curso_lecciones").select("id, modulo_id, curso_modulos!inner(curso_id)").in("curso_modulos.curso_id", ids),
      sb.from("curso_accesos").select("id, curso_id").in("curso_id", ids),
    ]);

    const contar = (rows: Row[] | null, clave: (r: Row) => string | undefined) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) {
        const k = clave(r);
        if (k) m.set(k, (m.get(k) ?? 0) + 1);
      }
      return m;
    };
    const modulosPorCurso = contar(modulos, (m) => m.curso_id);
    const leccionesPorCurso = contar(lecciones, (l) => l.curso_modulos?.curso_id);
    const alumnosPorCurso = contar(accesos, (a) => a.curso_id);

    return cursos.map((c: Row) => ({
      ...baseCurso(c),
      numModulos: modulosPorCurso.get(c.id) ?? 0,
      numLecciones: leccionesPorCurso.get(c.id) ?? 0,
      numAlumnos: alumnosPorCurso.get(c.id) ?? 0,
    }));
  } catch {
    return [];
  }
}

const baseCurso = (c: Row) => ({
  id: c.id as string,
  slug: c.slug as string,
  titulo: c.titulo as string,
  descripcion: (c.descripcion as string | null) ?? null,
  portadaUrl: (c.portada_url as string | null) ?? null,
  precioMxn: c.precio_mxn === null || c.precio_mxn === undefined ? null : Number(c.precio_mxn),
  activo: Boolean(c.activo),
  driveFolderId: (c.drive_folder_id as string | null) ?? null,
  tipo: (c.tipo === "mentoria" ? "mentoria" : "curso") as TipoCurso,
});

const aLeccion = (l: Row): CursoLeccion => ({
  id: l.id as string,
  titulo: l.titulo as string,
  tipo: (l.tipo as TipoLeccion) || "video",
  driveFileId: (l.drive_file_id as string | null) ?? null,
  urlExterna: (l.url_externa as string | null) ?? null,
  duracionSeg: l.duracion_seg === null || l.duracion_seg === undefined ? null : Number(l.duracion_seg),
  orden: Number(l.orden) || 0,
  etiqueta: (l.etiqueta as Etiqueta) || "nucleo",
  opcional: Boolean(l.opcional),
  preview: Boolean(l.preview),
  publicada: l.publicada ?? true,
  cta: (l.cta as Cta) || "ninguno",
  contenido: (l.contenido as Record<string, unknown>) ?? {},
  marcadores: validarMarcadores(l.marcadores),
  recursos: validarRecursos(l.recursos),
  estadoProduccion: (l.estado_produccion as EstadoProduccion) || "guion",
});

/** Detalle completo de un curso: módulos, lecciones, accesos y contadores. */
export async function getCursoDetalle(id: string): Promise<CursoDetalle | null> {
  try {
    const sb = supabaseAdmin();
    const { data: c } = await sb.from("cursos").select("*").eq("id", id).maybeSingle();
    if (!c) return null;

    const { data: modulos } = await sb.from("curso_modulos").select("*").eq("curso_id", id).order("orden", { ascending: true });
    const modIds = (modulos ?? []).map((m: Row) => m.id as string);
    const { data: lecciones } = modIds.length
      ? await sb.from("curso_lecciones").select("*").in("modulo_id", modIds).order("orden", { ascending: true })
      : { data: [] };

    const COLS_ACC = "id, email, origen, otorgado_por, created_at";
    const ra = await sb.from("curso_accesos").select(`${COLS_ACC}, vence_en`).eq("curso_id", id).order("created_at", { ascending: false });
    const accesos: Row[] | null = ra.error
      ? (await sb.from("curso_accesos").select(COLS_ACC).eq("curso_id", id).order("created_at", { ascending: false })).data
      : ra.data;

    const [interesados, entregasPendientes, mentorias, venta, fundadores, avisame, estrenos] = await Promise.all([
      contarSeguro(sb.from("curso_interes").select("id", { count: "exact", head: true }).eq("curso_id", id).eq("producto", "mentoria")),
      contarSeguro(sb.from("curso_entregas").select("id", { count: "exact", head: true }).eq("curso_id", id).eq("estado", "enviada")),
      sb.from("cursos").select("id, titulo").eq("tipo", "mentoria").then((r: Row) => (r.error ? [] : r.data ?? [])),
      ventaDeCurso(sb, c),
      contarFundadores(sb, id),
      listaAvisame(sb, id),
      estrenosAvisados(sb, (lecciones ?? []).map((l: Row) => l.id as string)),
    ]);

    const porModulo = new Map<string, CursoLeccion[]>();
    for (const l of lecciones ?? []) {
      const arr = porModulo.get(l.modulo_id as string) ?? [];
      arr.push(aLeccion(l));
      porModulo.set(l.modulo_id as string, arr);
    }

    return {
      ...baseCurso(c),
      config: leerConfig(c.config),
      revisionesIncluidas: Number(c.revisiones_incluidas ?? 1) || 0,
      numModulos: (modulos ?? []).length,
      numLecciones: (lecciones ?? []).length,
      numAlumnos: (accesos ?? []).length,
      modulos: (modulos ?? []).map((m: Row) => ({
        id: m.id as string,
        titulo: m.titulo as string,
        orden: Number(m.orden) || 0,
        ruta: (m.ruta as Ruta) || "principal",
        descripcion: (m.descripcion as string | null) ?? null,
        lecciones: porModulo.get(m.id as string) ?? [],
      })),
      accesos: (accesos ?? []).map((a: Row) => ({
        id: a.id as string,
        email: a.email as string,
        origen: (a.origen as CursoAcceso["origen"]) || "manual",
        otorgadoPor: (a.otorgado_por as string | null) ?? null,
        createdAt: (a.created_at as string) || new Date().toISOString(),
        venceEn: (a.vence_en as string | null) ?? null,
      })),
      interesados,
      entregasPendientes,
      mentorias: (mentorias as Row[]).filter((m) => m.id !== id).map((m) => ({ id: m.id as string, titulo: m.titulo as string })),
      venta,
      fundadores,
      avisame,
      estrenosAvisados: estrenos,
    };
  } catch {
    return null;
  }
}

/** Lecciones (de esta lista) con correo de estreno ya mandado, según la bitácora. */
async function estrenosAvisados(sb: Row, leccionIds: string[]): Promise<string[]> {
  if (!leccionIds.length) return [];
  const { data } = await sb.from("actividad").select("entidad_id").eq("tipo", "curso_estreno_avisado").in("entidad_id", leccionIds);
  return [...new Set(((data ?? []) as Row[]).map((r) => r.entidad_id as string))];
}

async function contarSeguro(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  try {
    const { count, error } = await q;
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}

/** Una lección con el título de su curso — para la vista de grabación. */
export async function getLeccionParaGrabar(cursoId: string, leccionId: string): Promise<{
  curso: CursoDetalle; leccion: CursoLeccion; modulo: CursoModulo; anterior: string | null; siguiente: string | null;
} | null> {
  const curso = await getCursoDetalle(cursoId);
  if (!curso) return null;
  const orden = curso.modulos.flatMap((m) => m.lecciones.map((l) => ({ l, m })));
  const i = orden.findIndex((x) => x.l.id === leccionId);
  if (i < 0) return null;
  return {
    curso,
    leccion: orden[i].l,
    modulo: orden[i].m,
    anterior: orden[i - 1]?.l.id ?? null,
    siguiente: orden[i + 1]?.l.id ?? null,
  };
}

export interface EntregaAdmin {
  id: string;
  cursoId: string;
  cursoTitulo: string;
  leccionId: string;
  leccionTitulo: string;
  email: string;
  nombre: string;
  bytes: number | null;
  mime: string | null;
  autoevaluacion: Record<string, number>;
  comentarioAlumno: string | null;
  estado: "enviada" | "revisada";
  conRevision: boolean;
  retro: string | null;
  rubricaProfe: Record<string, number>;
  retroPor: string | null;
  revisadaEn: string | null;
  createdAt: string;
  rubrica: { criterio: string; niveles: string[] }[];
}

/** Bandeja de entregas: pendientes primero, luego las revisadas más recientes. */
export async function getEntregasAdmin(filtro: { cursoId?: string; estado?: "enviada" | "revisada" } = {}): Promise<EntregaAdmin[]> {
  try {
    const sb = supabaseAdmin();
    let q = sb
      .from("curso_entregas")
      .select("*, cursos(titulo), curso_lecciones(titulo, contenido)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filtro.cursoId) q = q.eq("curso_id", filtro.cursoId);
    if (filtro.estado) q = q.eq("estado", filtro.estado);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as Row[])
      .map((e) => ({
        id: e.id,
        cursoId: e.curso_id,
        cursoTitulo: e.cursos?.titulo ?? "",
        leccionId: e.leccion_id,
        leccionTitulo: e.curso_lecciones?.titulo ?? "",
        email: e.email,
        nombre: e.nombre,
        bytes: e.bytes == null ? null : Number(e.bytes),
        mime: e.mime ?? null,
        autoevaluacion: (e.autoevaluacion as Record<string, number>) ?? {},
        comentarioAlumno: e.comentario_alumno ?? null,
        estado: e.estado === "revisada" ? "revisada" : "enviada",
        conRevision: e.con_revision !== false,
        retro: e.retro ?? null,
        rubricaProfe: (e.rubrica_profe as Record<string, number>) ?? {},
        retroPor: e.retro_por ?? null,
        revisadaEn: e.revisada_en ?? null,
        createdAt: e.created_at,
        rubrica: validarRubrica(e.curso_lecciones?.contenido?.rubrica),
      }) as EntregaAdmin)
      .sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "enviada" ? -1 : 1));
  } catch {
    return [];
  }
}

/** slug único a partir del título ("Mezcla y Master" → "mezcla-y-master", "-2" si choca). */
export async function slugDisponible(titulo: string): Promise<string> {
  const base = titulo
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quita acentos (á → a)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "curso";

  const sb = supabaseAdmin();
  let slug = base;
  let n = 2;
  for (;;) {
    const { data } = await sb.from("cursos").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${n++}`;
  }
}
