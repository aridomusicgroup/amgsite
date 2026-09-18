import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leerConfig, type ConfigCurso, type Etiqueta, type Ruta, type TipoLeccion } from "@/lib/cursos-tipos";

/**
 * Lo que la página de venta pública (/cursos/<slug>) puede mostrar de un
 * curso: títulos del temario completo (aunque no esté grabado — es el mapa que
 * se vende en preventa) y las lecciones marcadas como vista previa gratis.
 * Nunca IDs de Drive ni guiones.
 */

export interface LeccionPublica {
  id: string;
  titulo: string;
  tipo: TipoLeccion;
  etiqueta: Etiqueta;
  opcional: boolean;
  duracionSeg: number | null;
  /** Se puede ver gratis (vista previa publicada y con video). */
  gratis: boolean;
}

export interface CursoPublico {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  portadaUrl: string | null;
  precioMxn: number | null;
  revisionesIncluidas: number;
  config: ConfigCurso;
  modulos: { titulo: string; descripcion: string | null; ruta: Ruta; lecciones: LeccionPublica[] }[];
  conteo: { lecciones: number; capsulas: number; profundas: number; evaluaciones: number; tablaturas: number; publicadas: number; minutos: number };
}

export async function getCursoPublico(slug: string): Promise<CursoPublico | null> {
  try {
    const sb = supabaseAdmin();
    const { data: c } = await sb.from("cursos").select("*").eq("slug", slug).eq("activo", true).maybeSingle();
    if (!c || c.tipo === "mentoria") return null;

    const { data: modulos } = await sb.from("curso_modulos").select("id, titulo, descripcion, ruta, orden").eq("curso_id", c.id).order("orden");
    const ids = (modulos ?? []).map((m) => m.id as string);
    const { data: lecciones } = ids.length
      ? await sb.from("curso_lecciones")
          .select("id, modulo_id, titulo, tipo, etiqueta, opcional, preview, publicada, drive_file_id, duracion_seg, orden")
          .in("modulo_id", ids).order("orden")
      : { data: [] };

    const porModulo = new Map<string, LeccionPublica[]>();
    let publicadas = 0;
    let minutos = 0;
    for (const l of lecciones ?? []) {
      if (l.publicada) publicadas++;
      minutos += Math.round((Number(l.duracion_seg) || 0) / 60);
      const arr = porModulo.get(l.modulo_id as string) ?? [];
      arr.push({
        id: l.id as string,
        titulo: l.titulo as string,
        tipo: (l.tipo as TipoLeccion) || "video",
        etiqueta: (l.etiqueta as Etiqueta) || "nucleo",
        opcional: Boolean(l.opcional),
        duracionSeg: l.duracion_seg == null ? null : Number(l.duracion_seg),
        gratis: Boolean(l.preview && l.publicada && l.drive_file_id && l.tipo === "video"),
      });
      porModulo.set(l.modulo_id as string, arr);
    }
    const todas = [...porModulo.values()].flat();
    const n = (f: (l: LeccionPublica) => boolean) => todas.filter(f).length;

    return {
      id: c.id as string,
      slug: c.slug as string,
      titulo: c.titulo as string,
      descripcion: (c.descripcion as string | null) ?? null,
      portadaUrl: (c.portada_url as string | null) ?? null,
      precioMxn: c.precio_mxn == null ? null : Number(c.precio_mxn),
      revisionesIncluidas: Number(c.revisiones_incluidas ?? 1) || 0,
      config: leerConfig(c.config),
      modulos: (modulos ?? []).map((m) => ({
        titulo: m.titulo as string,
        descripcion: (m.descripcion as string | null) ?? null,
        ruta: (m.ruta as Ruta) || "principal",
        lecciones: porModulo.get(m.id as string) ?? [],
      })),
      conteo: {
        lecciones: n((l) => l.etiqueta === "nucleo" || l.etiqueta === "herramienta" || l.etiqueta === "filosofia"),
        capsulas: n((l) => l.etiqueta === "capsula"),
        profundas: n((l) => l.etiqueta === "profunda"),
        evaluaciones: n((l) => l.etiqueta === "evaluacion"),
        tablaturas: n((l) => l.tipo === "tab"),
        publicadas,
        minutos,
      },
    };
  } catch {
    return null;
  }
}

/** Una lección de vista previa gratis (valida que de verdad lo sea). */
export async function leccionGratis(leccionId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/i.test(leccionId)) return null;
  const { data } = await supabaseAdmin()
    .from("curso_lecciones")
    .select("drive_file_id, preview, publicada, tipo, curso_modulos!inner(cursos!inner(activo))")
    .eq("id", leccionId)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (!d?.preview || !d.publicada || d.tipo !== "video" || !d.drive_file_id || !d.curso_modulos?.cursos?.activo) return null;
  return d.drive_file_id as string;
}
