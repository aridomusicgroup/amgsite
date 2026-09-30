import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderizables, type Renderizable } from "@/lib/render-jobs";
import { musicosDeVenta } from "@/lib/musicos-venta";

/**
 * La ficha de REAPER de un proyecto (o de un tema, en un EP): todo lo que salió
 * de esa carpeta y a quién le llegó, en una sola lectura.
 *
 * Previos al cliente, stems y cuadrar a la rejilla salen de `item.jobs` — ya
 * vienen ahí. Lo que esto agrega es el lado de los MÚSICOS, que vive repartido
 * en tres tablas que no se hablan entre sí: a quién se contrató (la venta), a
 * quién se le mandó previo (`render_jobs`) y qué subió cada quien
 * (`musico_asignaciones` → `musico_archivos`). Juntarlas aquí es lo que deja
 * ver de un vistazo "a Adal se le mandó el previo el martes y no ha subido nada".
 *
 * El envío a edición (el material para cuantizar) NO se lee aquí: esa pantalla
 * ya tiene su API con barra de progreso que se refresca sola, y se reutiliza.
 */

export interface PrevioAMusico {
  jobId: string;
  fecha: string;
  estado: string;
  /** Cuándo le llegó el correo. Null = nunca salió (sin correo, o falló). */
  avisadoEn: string | null;
  url: string | null;
  /** Reenvío de un previo ya hecho, no un render nuevo. */
  reenvio: boolean;
}

export interface SubidasMusico {
  previos: number;
  stems: number;
  /** Stems que ya entraron al .rpp. */
  importados: number;
  conError: number;
  ultima: string | null;
}

export interface MusicoEnFicha {
  musicoId: string;
  nombre: string;
  instrumento: string | null;
  /** Aparece en los pagos de la venta: se le contrató para esto. */
  contratado: boolean;
  portalActivo: boolean;
  previos: PrevioAMusico[];
  /** Tiene el trabajo en /musico. Null = no se le ha dejado nada en el portal. */
  asignacion: { estado: string } | null;
  subidas: SubidasMusico;
}

export interface FichaReaper {
  item: Renderizable;
  musicos: MusicoEnFicha[];
  /** musico_id → nombre, para rotular los previos que subió un músico. */
  nombres: Record<string, string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Fila = Record<string, unknown>;

/**
 * `key` es la misma llave de la lista de REAPER: el id del tema si es canción
 * de un EP, si no el del proyecto. Null si no existe o no es renderizable.
 */
export async function fichaReaper(key: string): Promise<FichaReaper | null> {
  if (!UUID.test(key)) return null;
  const sb = supabaseAdmin();

  const { data: tema } = await sb
    .from("proyecto_tareas")
    .select("proyecto_id")
    .eq("id", key)
    .eq("es_cancion", true)
    .maybeSingle();
  const proyectoId = (tema?.proyecto_id as string | undefined) ?? key;

  const item = (await renderizables({ proyectoId })).find((r) => r.key === key);
  if (!item) return null;

  const musicos = await musicosDeLaFicha(item).catch(() => []);
  const nombres = Object.fromEntries(musicos.map((m) => [m.musicoId, m.nombre]));

  // Un previo que subió un músico y aprobamos también trae musico_id; si ese
  // músico no está en la lista (se le quitó la asignación), falta su nombre.
  const sueltos = item.jobs
    .map((j) => j.musicoId)
    .filter((id): id is string => Boolean(id) && !nombres[id as string]);
  if (sueltos.length) {
    const { data } = await sb.from("musicos").select("id, nombre").in("id", [...new Set(sueltos)]);
    for (const m of (data ?? []) as Fila[]) nombres[m.id as string] = m.nombre as string;
  }

  return { item, musicos, nombres };
}

/** Contratados + a quién se le mandó previo + quién tiene trabajo en el portal. */
async function musicosDeLaFicha(item: Renderizable): Promise<MusicoEnFicha[]> {
  const sb = supabaseAdmin();

  // En un tema de EP la asignación cuelga del tema; en un proyecto normal,
  // de su "Grabar X" (o de nada) — ahí todas las del proyecto son de esta carpeta.
  let qAsig = sb
    .from("musico_asignaciones")
    .select("id, musico_id, tarea_id, instrumento, estado")
    .eq("proyecto_id", item.proyectoId);
  if (item.tareaId) qAsig = qAsig.eq("tarea_id", item.tareaId);

  const [contratados, asigRes] = await Promise.all([
    musicosDeVenta(sb, item.proyectoId).catch(() => []),
    qAsig,
  ]);
  const asignaciones = (asigRes.data ?? []) as Fila[];

  const { data: archRaw } = asignaciones.length
    ? await sb
        .from("musico_archivos")
        .select("asignacion_id, clase, subido_at, importado_at, error")
        .in("asignacion_id", asignaciones.map((a) => a.id as string))
    : { data: [] };
  const archivos = (archRaw ?? []) as Fila[];

  const previosMusico = item.jobs.filter((j) => j.tipo === "musico" && j.musicoId);

  const ids = new Set<string>([
    ...contratados.map((c) => c.id),
    ...asignaciones.map((a) => a.musico_id as string),
    ...previosMusico.map((j) => j.musicoId as string),
  ]);
  if (!ids.size) return [];

  const { data: catRaw } = await sb.from("musicos").select("id, nombre, portal_activo").in("id", [...ids]);
  const catalogo = new Map(((catRaw ?? []) as Fila[]).map((m) => [m.id as string, m]));

  const salida: MusicoEnFicha[] = [];
  for (const id of ids) {
    const cat = catalogo.get(id);
    const contratado = contratados.find((c) => c.id === id);
    const suyas = asignaciones.filter((a) => a.musico_id === id);
    const suyasIds = new Set(suyas.map((a) => a.id as string));
    const susArchivos = archivos.filter((a) => suyasIds.has(a.asignacion_id as string));
    const susPrevios = previosMusico.filter((j) => j.musicoId === id);

    salida.push({
      musicoId: id,
      nombre: (cat?.nombre as string | undefined) ?? contratado?.nombre ?? "—",
      instrumento:
        contratado?.instrumento
        || (suyas[0]?.instrumento as string | undefined)
        || (susPrevios[0]?.opciones?.instrumento ?? null),
      contratado: Boolean(contratado),
      portalActivo: cat?.portal_activo === true,
      previos: susPrevios.map((j) => ({
        jobId: j.id,
        fecha: j.createdAt,
        estado: j.estado,
        avisadoEn: j.avisadoEn,
        url: j.enlacePublico ?? j.driveUrls?.[0]?.url ?? null,
        reenvio: j.origen !== "reaper" || Boolean((j.opciones as Record<string, unknown> | null)?.reenvioDe),
      })),
      asignacion: suyas.length ? { estado: String(suyas[0].estado ?? "pendiente") } : null,
      subidas: resumirSubidas(susArchivos),
    });
  }

  // Primero a quien le falta algo: contratado y sin previo arriba.
  const peso = (m: MusicoEnFicha) => (m.previos.length ? 1 : 0) + (m.subidas.stems ? 1 : 0);
  return salida.sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, "es"));
}

function resumirSubidas(archivos: Fila[]): SubidasMusico {
  const fechas = archivos.map((a) => a.subido_at as string).filter(Boolean).sort();
  return {
    previos: archivos.filter((a) => a.clase === "previo").length,
    stems: archivos.filter((a) => a.clase === "stem").length,
    importados: archivos.filter((a) => a.clase === "stem" && a.importado_at).length,
    conError: archivos.filter((a) => a.error).length,
    ultima: fechas.at(-1) ?? null,
  };
}
