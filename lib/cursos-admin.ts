import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Capa de datos de Cursos para el ADMIN (autoría + accesos). El panel de
 * cliente tiene su propia capa (lib/cursos-cliente.ts) — más angosta, por
 * correo, sin exponer nada de edición.
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
  numModulos: number;
  numLecciones: number;
  numAlumnos: number;
}

export interface CursoLeccion {
  id: string;
  titulo: string;
  tipo: "video" | "pdf" | "link";
  driveFileId: string | null;
  urlExterna: string | null;
  duracionSeg: number | null;
  orden: number;
}

export interface CursoModulo {
  id: string;
  titulo: string;
  orden: number;
  lecciones: CursoLeccion[];
}

export interface CursoAcceso {
  id: string;
  email: string;
  origen: "manual" | "venta" | "regalo";
  otorgadoPor: string | null;
  createdAt: string;
}

export interface CursoDetalle extends CursoAdmin {
  modulos: CursoModulo[];
  accesos: CursoAcceso[];
}

/** Lista de cursos para la pantalla de autoría, con conteos. */
export async function getCursosAdmin(): Promise<CursoAdmin[]> {
  try {
    const sb = supabaseAdmin();
    const { data: cursos } = await sb
      .from("cursos")
      .select("id, slug, titulo, descripcion, portada_url, precio_mxn, activo, drive_folder_id")
      .order("created_at", { ascending: false });
    if (!cursos?.length) return [];

    const ids = cursos.map((c) => c.id as string);
    const [{ data: modulos }, { data: lecciones }, { data: accesos }] = await Promise.all([
      sb.from("curso_modulos").select("id, curso_id").in("curso_id", ids),
      sb.from("curso_lecciones").select("id, modulo_id, curso_modulos!inner(curso_id)").in("curso_modulos.curso_id", ids),
      sb.from("curso_accesos").select("id, curso_id").in("curso_id", ids),
    ]);

    const modulosPorCurso = new Map<string, number>();
    for (const m of modulos ?? []) modulosPorCurso.set(m.curso_id as string, (modulosPorCurso.get(m.curso_id as string) ?? 0) + 1);
    const leccionesPorCurso = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const l of (lecciones ?? []) as any[]) {
      const cid = l.curso_modulos?.curso_id as string | undefined;
      if (cid) leccionesPorCurso.set(cid, (leccionesPorCurso.get(cid) ?? 0) + 1);
    }
    const alumnosPorCurso = new Map<string, number>();
    for (const a of accesos ?? []) alumnosPorCurso.set(a.curso_id as string, (alumnosPorCurso.get(a.curso_id as string) ?? 0) + 1);

    return cursos.map((c) => ({
      id: c.id as string,
      slug: c.slug as string,
      titulo: c.titulo as string,
      descripcion: (c.descripcion as string | null) ?? null,
      portadaUrl: (c.portada_url as string | null) ?? null,
      precioMxn: c.precio_mxn === null ? null : Number(c.precio_mxn),
      activo: Boolean(c.activo),
      driveFolderId: (c.drive_folder_id as string | null) ?? null,
      numModulos: modulosPorCurso.get(c.id as string) ?? 0,
      numLecciones: leccionesPorCurso.get(c.id as string) ?? 0,
      numAlumnos: alumnosPorCurso.get(c.id as string) ?? 0,
    }));
  } catch {
    return [];
  }
}

/** Detalle completo de un curso: módulos, lecciones y quién tiene acceso. */
export async function getCursoDetalle(id: string): Promise<CursoDetalle | null> {
  try {
    const sb = supabaseAdmin();
    const { data: c } = await sb
      .from("cursos")
      .select("id, slug, titulo, descripcion, portada_url, precio_mxn, activo, drive_folder_id")
      .eq("id", id)
      .maybeSingle();
    if (!c) return null;

    const { data: modulos } = await sb
      .from("curso_modulos")
      .select("id, titulo, orden")
      .eq("curso_id", id)
      .order("orden", { ascending: true });
    const modIds = (modulos ?? []).map((m) => m.id as string);

    const { data: lecciones } = modIds.length
      ? await sb.from("curso_lecciones")
          .select("id, modulo_id, titulo, tipo, drive_file_id, url_externa, duracion_seg, orden")
          .in("modulo_id", modIds)
          .order("orden", { ascending: true })
      : { data: [] };

    const { data: accesos } = await sb
      .from("curso_accesos")
      .select("id, email, origen, otorgado_por, created_at")
      .eq("curso_id", id)
      .order("created_at", { ascending: false });

    const leccionesPorModulo = new Map<string, CursoLeccion[]>();
    for (const l of lecciones ?? []) {
      const arr = leccionesPorModulo.get(l.modulo_id as string) ?? [];
      arr.push({
        id: l.id as string,
        titulo: l.titulo as string,
        tipo: (l.tipo as CursoLeccion["tipo"]) || "video",
        driveFileId: (l.drive_file_id as string | null) ?? null,
        urlExterna: (l.url_externa as string | null) ?? null,
        duracionSeg: l.duracion_seg === null ? null : Number(l.duracion_seg),
        orden: Number(l.orden) || 0,
      });
      leccionesPorModulo.set(l.modulo_id as string, arr);
    }

    return {
      id: c.id as string,
      slug: c.slug as string,
      titulo: c.titulo as string,
      descripcion: (c.descripcion as string | null) ?? null,
      portadaUrl: (c.portada_url as string | null) ?? null,
      precioMxn: c.precio_mxn === null ? null : Number(c.precio_mxn),
      activo: Boolean(c.activo),
      driveFolderId: (c.drive_folder_id as string | null) ?? null,
      numModulos: (modulos ?? []).length,
      numLecciones: (lecciones ?? []).length,
      numAlumnos: (accesos ?? []).length,
      modulos: (modulos ?? []).map((m) => ({
        id: m.id as string,
        titulo: m.titulo as string,
        orden: Number(m.orden) || 0,
        lecciones: leccionesPorModulo.get(m.id as string) ?? [],
      })),
      accesos: (accesos ?? []).map((a) => ({
        id: a.id as string,
        email: a.email as string,
        origen: (a.origen as CursoAcceso["origen"]) || "manual",
        otorgadoPor: (a.otorgado_por as string | null) ?? null,
        createdAt: (a.created_at as string) || new Date().toISOString(),
      })),
    };
  } catch {
    return null;
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
