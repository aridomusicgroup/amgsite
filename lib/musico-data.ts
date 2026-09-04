import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Lo que ve un músico externo en /musico.
 *
 * La regla de este archivo: **se piden solo las columnas que el músico puede
 * ver**, no se traen de más para filtrar en el componente. El músico es un
 * proveedor externo — el nombre del cliente, el folio, los montos y las demás
 * tareas del proyecto no salen de aquí, así que un descuido en el JSX no los
 * puede pintar. Por eso no se reusa `getProyectoDetalle()`.
 */

export interface MusicoSesion {
  id: string;
  nombre: string;
  email: string | null;
  instrumentos: string[];
}

export interface ArchivoMusico {
  id: string;
  clase: "previo" | "stem";
  /** A qué canal corresponde, cuando el instrumento lleva más de uno. */
  slot: number;
  nombre: string;
  subido_at: string;
  /** Solo para previos: si ya se le compartió al cliente. */
  aprobado_at: string | null;
  /** Solo para stems: si ya aterrizó en la computadora del estudio. */
  bajado_at: string | null;
  importado_at: string | null;
}

export interface AsignacionMusico {
  id: string;
  instrumento: string;
  nota: string | null;
  estado: string;
  /** Título de la canción. NUNCA el cliente ni el folio. */
  cancion: string;
  /** Título de la tarea, ej. "Grabar Charchetas". */
  tarea: string | null;
  fechaLimite: string | null;
  hecha: boolean;
  /** Enlace del previo de referencia que ya se le mandó, si hay. */
  referencia: string | null;
  /**
   * Cuántas pistas se le piden y cómo se llama cada una.
   *
   * Martín manda DOS charchetas —primera y segunda voz— y cada una va a un
   * canal distinto del proyecto. El portal le muestra un botón por canal, en
   * vez de adivinar por el orden en que suba: si se equivocara de orden, las
   * dos voces quedarían cruzadas y nadie se enteraría hasta abrir el proyecto.
   */
  canales: string[];
  archivos: ArchivoMusico[];
}

const ESTADOS_CERRADOS = ["cerrado", "cancelado"];

/**
 * El músico de la sesión, o null.
 *
 * Comprueba `portal_activo` en cada lectura a propósito: apagarle el
 * interruptor en Ajustes lo saca en su siguiente clic, sin tener que invalidar
 * su cookie (que es autocontenida y dura 30 días).
 */
export const getMusico = cache(async (musicoId: string): Promise<MusicoSesion | null> => {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("musicos")
      .select("id, nombre, email, instrumentos, activo, portal_activo")
      .eq("id", musicoId)
      .maybeSingle();
    if (!data || !data.activo || !data.portal_activo) return null;
    return {
      id: data.id as string,
      nombre: (data.nombre as string) ?? "",
      email: (data.email as string | null) ?? null,
      instrumentos: (data.instrumentos as string[] | null) ?? [],
    };
  } catch {
    return null;
  }
});

/** Sus asignaciones abiertas, con lo que ya subió en cada una. */
export async function asignacionesDeMusico(musicoId: string): Promise<AsignacionMusico[]> {
  const sb = supabaseAdmin();

  const { data: asigs } = await sb
    .from("musico_asignaciones")
    .select("id, instrumento, nota, estado, proyecto_id, tarea_id, proyectos(titulo, estado)")
    .eq("musico_id", musicoId)
    .order("creado_at", { ascending: false });
  if (!asigs?.length) return [];

  // Un proyecto cerrado o cancelado ya no es trabajo pendiente de nadie.
  const vivas = asigs.filter((a) => {
    const p = a.proyectos as unknown as { titulo: string; estado: string } | null;
    return p && !ESTADOS_CERRADOS.includes(p.estado);
  });
  if (!vivas.length) return [];

  const ids = vivas.map((a) => a.id as string);
  const tareaIds = vivas.map((a) => a.tarea_id as string | null).filter(Boolean) as string[];
  const proyIds = [...new Set(vivas.map((a) => a.proyecto_id as string))];

  const [archRes, tareasRes, refRes, canalesRes] = await Promise.all([
    // `slot` es columna nueva; sin el reintento, antes de la migración el
    // músico vería su tarjeta sin ninguno de los archivos que ya subió.
    sb.from("musico_archivos")
      .select("id, asignacion_id, clase, nombre, slot, subido_at, aprobado_at, bajado_at, importado_at")
      .in("asignacion_id", ids)
      .order("subido_at", { ascending: false })
      .then((r) => (r.error
        ? sb.from("musico_archivos")
            .select("id, asignacion_id, clase, nombre, subido_at, aprobado_at, bajado_at, importado_at")
            .in("asignacion_id", ids)
            .order("subido_at", { ascending: false })
        : r)),
    tareaIds.length
      ? sb.from("proyecto_tareas").select("id, titulo, fecha, hecho").in("id", tareaIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    // El previo de referencia que ya se le mandó por correo desde REAPER.
    sb.from("render_jobs")
      .select("proyecto_id, enlace_publico, created_at")
      .eq("musico_id", musicoId)
      .in("proyecto_id", proyIds)
      .eq("estado", "listo")
      .not("enlace_publico", "is", null)
      .order("created_at", { ascending: false }),
    sb.from("instrumento_pistas").select("instrumento, canales"),
  ]);

  // Sin acentos: el instrumento de la asignación lo escribe una persona y el
  // del mapa otra, y "Batería" contra "Bateria" no debe perder los canales.
  const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
  const canalesDe = (inst: string): string[] => {
    const fila = (canalesRes.data ?? []).find((m) => norm(String(m.instrumento)) === norm(inst));
    return String(fila?.canales ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  };

  const porAsig = new Map<string, ArchivoMusico[]>();
  for (const a of archRes.data ?? []) {
    const k = a.asignacion_id as string;
    const arr = porAsig.get(k) ?? [];
    arr.push({
      id: a.id as string,
      clase: (a.clase as "previo" | "stem") ?? "stem",
      // `a` puede venir del reintento SIN la columna: se lee de forma laxa.
      slot: Number((a as Record<string, unknown>).slot ?? 0) || 0,
      nombre: a.nombre as string,
      subido_at: a.subido_at as string,
      aprobado_at: (a.aprobado_at as string | null) ?? null,
      bajado_at: (a.bajado_at as string | null) ?? null,
      importado_at: (a.importado_at as string | null) ?? null,
    });
    porAsig.set(k, arr);
  }

  const tareas = new Map<string, { titulo: string; fecha: string | null; hecho: boolean }>();
  for (const t of tareasRes.data ?? []) {
    tareas.set(t.id as string, {
      titulo: t.titulo as string,
      fecha: (t.fecha as string | null) ?? null,
      hecho: Boolean(t.hecho),
    });
  }

  // El más reciente por proyecto (vienen ordenados de nuevo a viejo).
  const referencias = new Map<string, string>();
  for (const r of refRes.data ?? []) {
    const k = r.proyecto_id as string;
    if (!referencias.has(k)) referencias.set(k, r.enlace_publico as string);
  }

  return vivas.map((a) => {
    const p = a.proyectos as unknown as { titulo: string } | null;
    const t = a.tarea_id ? tareas.get(a.tarea_id as string) : undefined;
    return {
      id: a.id as string,
      instrumento: a.instrumento as string,
      nota: (a.nota as string | null) ?? null,
      estado: (a.estado as string) ?? "pendiente",
      cancion: p?.titulo ?? "Producción",
      tarea: t?.titulo ?? null,
      fechaLimite: t?.fecha ?? null,
      hecha: Boolean(t?.hecho),
      referencia: referencias.get(a.proyecto_id as string) ?? null,
      canales: canalesDe(a.instrumento as string),
      archivos: porAsig.get(a.id as string) ?? [],
    };
  });
}

/**
 * Una asignación que de verdad es de este músico, con lo que hace falta para
 * subirle un archivo. El equivalente barato de `proyectoDelPedido()`: mismo
 * candado de propiedad, sin traerse todo lo demás.
 */
export async function asignacionDeMusico(
  musicoId: string,
  asignacionId: string,
): Promise<{ id: string; proyectoId: string; tareaId: string | null; instrumento: string } | null> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("musico_asignaciones")
      .select("id, musico_id, proyecto_id, tarea_id, instrumento")
      .eq("id", asignacionId)
      .maybeSingle();
    if (!data || data.musico_id !== musicoId) return null;
    return {
      id: data.id as string,
      proyectoId: data.proyecto_id as string,
      tareaId: (data.tarea_id as string | null) ?? null,
      instrumento: data.instrumento as string,
    };
  } catch {
    return null;
  }
}

/**
 * Los músicos a los que SÍ se les puede asignar trabajo hoy.
 *
 * Filtra por `portal_activo` porque asignarle a alguien sin portal es escribir
 * una fila que nadie va a ver nunca.
 *
 * Si la consulta falla —lo más probable, antes de correr la migración, es que
 * `portal_activo` no exista— devuelve lista vacía en vez de lanzar: el bloque
 * de "Músico externo" se queda sin opciones, pero la ventana de la tarea abre
 * igual y nadie pierde acceso a lo demás.
 */
export async function musicosConPortal(): Promise<{ id: string; nombre: string; instrumentos: string[] }[]> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("musicos")
      .select("id, nombre, instrumentos, portal_activo")
      .eq("activo", true)
      .eq("portal_activo", true)
      .order("nombre");
    if (error) return [];
    return (data ?? []).map((m) => ({
      id: m.id as string,
      nombre: (m.nombre as string) ?? "",
      instrumentos: (m.instrumentos as string[] | null) ?? [],
    }));
  } catch {
    return [];
  }
}
