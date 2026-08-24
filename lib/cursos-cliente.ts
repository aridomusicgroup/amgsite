import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailsDeCliente } from "@/lib/cuenta-cliente";

/**
 * Capa de datos de Cursos para el panel del CLIENTE (/cuenta). Todo resuelto
 * por correo (con alias, igual que pedidos/contratos) — nunca por user id.
 * `curso_accesos` es la única fuente de verdad de quién entra a qué.
 */

export interface CursoResumen {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  portadaUrl: string | null;
  pct: number;
}

export interface LeccionCliente {
  id: string;
  titulo: string;
  tipo: "video" | "pdf" | "link";
  urlExterna: string | null;
  duracionSeg: number | null;
  visto: boolean;
}

export interface ModuloCliente {
  id: string;
  titulo: string;
  lecciones: LeccionCliente[];
}

export interface CursoDetalleCliente {
  id: string;
  titulo: string;
  descripcion: string | null;
  modulos: ModuloCliente[];
  pct: number;
}

/** Cursos a los que este correo (o un alias suyo) tiene acceso, con avance. */
export async function cursosDelCliente(email: string): Promise<CursoResumen[]> {
  try {
    const emails = await emailsDeCliente(email);
    if (!emails.length) return [];
    const sb = supabaseAdmin();
    const { data: accesos } = await sb.from("curso_accesos").select("curso_id").in("email", emails);
    const cursoIds = [...new Set((accesos ?? []).map((a) => a.curso_id as string))];
    if (!cursoIds.length) return [];

    const { data: cursos } = await sb
      .from("cursos")
      .select("id, slug, titulo, descripcion, portada_url")
      .in("id", cursoIds)
      .eq("activo", true);
    if (!cursos?.length) return [];

    const pcts = await Promise.all(cursos.map((c) => pctAvance(sb, c.id as string, emails)));

    return cursos.map((c, i) => ({
      id: c.id as string,
      slug: c.slug as string,
      titulo: c.titulo as string,
      descripcion: (c.descripcion as string | null) ?? null,
      portadaUrl: (c.portada_url as string | null) ?? null,
      pct: pcts[i],
    }));
  } catch {
    return [];
  }
}

/** true si este correo (o un alias suyo) tiene acceso pagado/otorgado a ese curso. */
export async function clienteTieneCurso(email: string, cursoId: string): Promise<boolean> {
  try {
    const emails = await emailsDeCliente(email);
    if (!emails.length) return false;
    const sb = supabaseAdmin();
    const { data } = await sb.from("curso_accesos").select("id").eq("curso_id", cursoId).in("email", emails).limit(1);
    return Boolean(data && data.length);
  } catch {
    return false;
  }
}

/** Detalle de un curso para el cliente (sin drive_file_id — eso solo lo usa el proxy de streaming). */
export async function getCursoDetalleCliente(email: string, cursoId: string): Promise<CursoDetalleCliente | null> {
  const tiene = await clienteTieneCurso(email, cursoId);
  if (!tiene) return null;

  try {
    const sb = supabaseAdmin();
    const { data: c } = await sb.from("cursos").select("id, titulo, descripcion").eq("id", cursoId).maybeSingle();
    if (!c) return null;

    const { data: modulos } = await sb
      .from("curso_modulos").select("id, titulo, orden").eq("curso_id", cursoId).order("orden", { ascending: true });
    const modIds = (modulos ?? []).map((m) => m.id as string);

    const { data: lecciones } = modIds.length
      ? await sb.from("curso_lecciones")
          .select("id, modulo_id, titulo, tipo, url_externa, duracion_seg, orden")
          .in("modulo_id", modIds)
          .order("orden", { ascending: true })
      : { data: [] };

    const emails = await emailsDeCliente(email);
    const leccionIds = (lecciones ?? []).map((l) => l.id as string);
    const { data: progreso } = leccionIds.length
      ? await sb.from("curso_progreso").select("leccion_id, visto").in("leccion_id", leccionIds).in("email", emails)
      : { data: [] };
    const vistoSet = new Set((progreso ?? []).filter((p) => p.visto).map((p) => p.leccion_id as string));

    const leccionesPorModulo = new Map<string, LeccionCliente[]>();
    for (const l of lecciones ?? []) {
      const arr = leccionesPorModulo.get(l.modulo_id as string) ?? [];
      arr.push({
        id: l.id as string,
        titulo: l.titulo as string,
        tipo: (l.tipo as LeccionCliente["tipo"]) || "video",
        urlExterna: (l.url_externa as string | null) ?? null,
        duracionSeg: l.duracion_seg === null ? null : Number(l.duracion_seg),
        visto: vistoSet.has(l.id as string),
      });
      leccionesPorModulo.set(l.modulo_id as string, arr);
    }

    const total = (lecciones ?? []).length;
    const pct = total > 0 ? Math.round((vistoSet.size / total) * 100) : 0;

    return {
      id: c.id as string,
      titulo: c.titulo as string,
      descripcion: (c.descripcion as string | null) ?? null,
      modulos: (modulos ?? []).map((m) => ({
        id: m.id as string,
        titulo: m.titulo as string,
        lecciones: leccionesPorModulo.get(m.id as string) ?? [],
      })),
      pct,
    };
  } catch {
    return null;
  }
}

export interface LeccionStream {
  cursoId: string;
  tipo: "video" | "pdf" | "link";
  driveFileId: string | null;
}

/** Datos mínimos de una lección para el proxy de streaming (valida dueño del curso antes de servir bytes). */
export async function leccionParaStream(leccionId: string): Promise<LeccionStream | null> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("curso_lecciones")
      .select("tipo, drive_file_id, curso_modulos!inner(curso_id)")
      .eq("id", leccionId)
      .maybeSingle();
    if (!data) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cursoId = (data.curso_modulos as any)?.curso_id as string | undefined;
    if (!cursoId) return null;
    return {
      cursoId,
      tipo: (data.tipo as LeccionStream["tipo"]) || "video",
      driveFileId: (data.drive_file_id as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Marca (o desmarca) una lección como vista para este correo. */
export async function marcarProgreso(email: string, leccionId: string, visto: boolean): Promise<void> {
  const sb = supabaseAdmin();
  await sb.from("curso_progreso").upsert(
    { leccion_id: leccionId, email: email.trim().toLowerCase(), visto, visto_en: visto ? new Date().toISOString() : null, updated_at: new Date().toISOString() },
    { onConflict: "leccion_id,email" },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pctAvance(sb: any, cursoId: string, emails: string[]): Promise<number> {
  const { data: modulos } = await sb.from("curso_modulos").select("id").eq("curso_id", cursoId);
  const modIds = (modulos ?? []).map((m: { id: string }) => m.id);
  if (!modIds.length) return 0;
  const { data: lecciones } = await sb.from("curso_lecciones").select("id").in("modulo_id", modIds);
  const leccionIds = (lecciones ?? []).map((l: { id: string }) => l.id);
  if (!leccionIds.length) return 0;
  const { data: progreso } = await sb.from("curso_progreso").select("id").in("leccion_id", leccionIds).in("email", emails).eq("visto", true);
  return Math.round(((progreso ?? []).length / leccionIds.length) * 100);
}
