import "server-only";

/**
 * La carpeta de REAPER de un cliente, un proyecto o un tema de EP, vista desde
 * el panel.
 *
 * El script del estudio la encuentra por NOMBRE: RAÍZ / CLIENTE / PROYECTO
 * [/ TEMA]. Si cualquiera de esos nombres cambia y nadie avisa, deja de
 * encontrarla — pasó con Alfred ("ALFRED" en disco, "Alfred Kerr" en el panel).
 * Por eso, al renombrar:
 *
 *   1. se ANCLA el nombre de siempre en `reaper_carpeta` (así, digan lo que
 *      digan, el script la sigue encontrando), y
 *   2. se pregunta si también se renombra la carpeta. Si sí, se deja el
 *      encargo en `reaper_renombrar` y el script la mueve (reaper-sync/renombrar.js).
 *
 * `nombreCarpeta` es COPIA EXACTA de reaper-sync/rutas.js: si una se desviara,
 * el panel anclaría un nombre que en disco se escribe distinto.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const ILEGALES = /[\/:*?"<>|]/g;
export const nombreCarpeta = (s: string | null | undefined): string =>
  String(s ?? "").replace(ILEGALES, "").trim().toUpperCase();

export type TablaCarpeta = "contactos" | "proyectos" | "proyecto_tareas";

/** De qué columna sale el nombre de la carpeta en cada tabla. */
const CAMPO: Record<TablaCarpeta, string> = { contactos: "nombre", proyectos: "titulo", proyecto_tareas: "titulo" };

export interface CarpetaPendiente {
  tabla: TablaCarpeta;
  id: string;
  /** Como se llama hoy en disco. */
  actual: string;
  /** Como se llamaría con el nombre nuevo. */
  nueva: string;
  /** Falta el SQL de la columna: no se pudo anclar. */
  sinMigracion?: boolean;
}

/** ¿Alguno de estos proyectos ya tiene carpeta en disco? (un EP la tiene si nació algún tema) */
async function algunaCreada(sb: SB, proyectos: { id: string; tipo: string | null; reaper_creado: boolean | null }[]): Promise<boolean> {
  if (proyectos.some((p) => p.reaper_creado)) return true;
  const albums = proyectos.filter((p) => ["ep", "album"].includes(String(p.tipo ?? ""))).map((p) => p.id);
  if (!albums.length) return false;
  const { count } = await sb.from("proyecto_tareas").select("id", { count: "exact", head: true })
    .in("proyecto_id", albums).eq("es_cancion", true).eq("reaper_creado", true);
  return (count ?? 0) > 0;
}

/** ¿Ya tiene carpeta en disco? Y su ancla, si la hay. */
async function estado(sb: SB, tabla: TablaCarpeta, id: string): Promise<{ existe: boolean; ancla: string | null; sinColumna: boolean }> {
  const cols = tabla === "proyectos" ? "id, tipo, reaper_creado" : tabla === "proyecto_tareas" ? "id, es_cancion, reaper_creado" : "id";
  let sinColumna = false;
  let r = await sb.from(tabla).select(`${cols}, reaper_carpeta`).eq("id", id).maybeSingle();
  if (r.error) { sinColumna = true; r = await sb.from(tabla).select(cols).eq("id", id).maybeSingle(); }
  const f = r.data;
  if (!f) return { existe: false, ancla: null, sinColumna };

  let existe: boolean;
  if (tabla === "proyecto_tareas") existe = Boolean(f.es_cancion && f.reaper_creado);
  else if (tabla === "proyectos") existe = await algunaCreada(sb, [f]);
  else {
    // El cliente tiene carpeta si cualquiera de sus proyectos ya la tiene.
    const { data: ps } = await sb.from("proyectos").select("id, tipo, reaper_creado").eq("contacto_id", id);
    existe = await algunaCreada(sb, ps ?? []);
  }
  return { existe, ancla: (f.reaper_carpeta as string | null) ?? null, sinColumna };
}

/**
 * Llamar ANTES de guardar el nombre nuevo. Ancla la carpeta y devuelve lo que
 * hay que preguntarle a quien renombró, o null si no aplica (no tiene carpeta
 * todavía, o el nombre en disco no cambiaría).
 */
export async function anclarCarpeta(
  sb: SB, tabla: TablaCarpeta, id: string, viejo: string | null | undefined, nuevo: string,
): Promise<CarpetaPendiente | null> {
  try {
    const e = await estado(sb, tabla, id);
    if (!e.existe) return null;
    const actual = e.ancla || nombreCarpeta(viejo);
    const nueva = nombreCarpeta(nuevo);
    if (!actual || !nueva) return null;
    if (actual === nueva) {
      // Volvió al nombre de la carpeta: el ancla sobra.
      if (e.ancla) await sb.from(tabla).update({ reaper_carpeta: null }).eq("id", id);
      return null;
    }
    if (e.sinColumna) return { tabla, id, actual, nueva, sinMigracion: true };
    if (!e.ancla) await sb.from(tabla).update({ reaper_carpeta: actual }).eq("id", id);
    return { tabla, id, actual, nueva };
  } catch {
    return null;
  }
}

/**
 * Lo que queda por preguntar de algo ya renombrado: anclado a un nombre que ya
 * no es el suyo, y sin un renombre pedido. Lo usa la ventana de la tarea, que
 * guarda el título mientras se escribe y pregunta al cerrarse.
 */
export async function carpetaPendiente(sb: SB, tabla: TablaCarpeta, id: string): Promise<CarpetaPendiente | null> {
  const { data: f, error } = await sb.from(tabla).select(`${CAMPO[tabla]}, reaper_carpeta, reaper_renombrar`).eq("id", id).maybeSingle();
  if (error || !f?.reaper_carpeta || f.reaper_renombrar) return null;
  const nueva = nombreCarpeta(f[CAMPO[tabla]]);
  return f.reaper_carpeta === nueva ? null : { tabla, id, actual: f.reaper_carpeta, nueva };
}

/** "Sí, renómbrala": deja el encargo para el script del estudio. */
export async function pedirRenombre(sb: SB, tabla: TablaCarpeta, id: string): Promise<boolean> {
  const { data: f } = await sb.from(tabla).select(CAMPO[tabla]).eq("id", id).maybeSingle();
  const nueva = nombreCarpeta(f?.[CAMPO[tabla]]);
  if (!nueva) return false;
  const { error } = await sb.from(tabla).update({ reaper_renombrar: nueva }).eq("id", id);
  return !error;
}
