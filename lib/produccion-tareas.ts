import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Motor de plantillas de tareas de producción — COMPARTIDO.
 * Lo usan tanto el panel de Producción (/api/admin/proyectos) como Ventas
 * (/api/admin/ventas, incluido "convertir cotización en venta"), para que un
 * proyecto nazca siempre con las mismas tareas ricas, subtareas y responsables.
 */

export type TplTarea = {
  titulo: string;
  resp?: string;
  /** Elección explícita desde la pantalla. Gana sobre `resp`, que casa por nombre. */
  respId?: string | null;
  subs?: string[];
  /** El instrumento que generó esta tarea, si salió del hueco de instrumentos. */
  instrumento?: string;
};

const SUBS_EDITAR = [
  "Cuantizar guitarras", "Cuantizar bass", "Eliminar ruidos",
  "Eliminar silencios", "Corregir empalmes", "Mandarlo a mezcla",
];

/** Tareas que dispara cada producción de catálogo (caen a Tozi). */
export const DISTRIBUCION = [
  "Subir a BeatStars", "Portada de YouTube", "Portada de BeatStars",
  "Subir archivos a Drive", "Actualizar catálogo",
];

/**
 * Plantilla de FÁBRICA, según el tipo de proyecto y los instrumentos elegidos.
 *
 * Desde 2026-09-05 las plantillas se editan desde el panel y viven en
 * `tarea_plantillas`. Esto se queda como el respaldo: es lo que se usa si la
 * migración todavía no corrió, si Supabase no responde, o si ese tipo no tiene
 * ni una fila configurada. Un proyecto no puede nacer sin tareas porque alguien
 * no ha corrido un .sql.
 *
 * Privada a propósito: la puerta de entrada es `crearTareasDeProyecto`, que
 * consulta primero la base.
 */
function plantillaTareas(tipo: string | undefined, instrumentos: string[]): TplTarea[] {
  const grabar: TplTarea[] = instrumentos.map((i) => ({ titulo: `Grabar ${i}`, resp: "eliud", instrumento: i }));
  switch (tipo) {
    case "beat":
      return [
        { titulo: "Hacer maqueta", resp: "eliud" },
        { titulo: "Grabar guitarras", resp: "eliud" },
        { titulo: "Grabar bass", resp: "eliud" },
        { titulo: "Editar y cuantizar", resp: "diego", subs: SUBS_EDITAR },
        { titulo: "Mezclar", resp: "luis" },
        { titulo: "Masterizar", resp: "luis" },
        { titulo: "Hacer portada", resp: "tozi" },
        { titulo: "Hacer video", resp: "tozi" },
        { titulo: "Subir beat", resp: "tozi", subs: ["Beatstars", "YouTube", "Links al admin"] },
      ];
    case "grabacion":
      return [
        ...grabar,
        { titulo: "Editar y cuantizar", resp: "diego", subs: SUBS_EDITAR },
        { titulo: "Subir archivos a Drive", resp: "diego" },
      ];
    case "mezcla_master":
      return [{ titulo: "Editar y cuantizar", resp: "diego", subs: SUBS_EDITAR }];
    case "beat_personalizado":
      return [
        { titulo: "Hacer maqueta", resp: "eliud" },
        ...grabar,
        { titulo: "Editar y cuantizar", resp: "diego", subs: SUBS_EDITAR },
        { titulo: "Mezclar", resp: "luis" },
        { titulo: "Masterizar", resp: "luis" },
        { titulo: "Subir a Drive", resp: "luis" },
      ];
    default:
      return [];
  }
}

/** Resuelve un alias de nombre ("eliud","diego","luis","tozi") al id del equipo. */
export function resolverEquipo(eq: { id: string; nombre: string }[]): (key: string) => string | null {
  const alias: Record<string, string[]> = {
    eliud: ["eliud"], diego: ["diego"], luis: ["luis"], tozi: ["tozi", "cervantes", "emmanuel"],
  };
  return (key: string) => {
    const needles = alias[key.toLowerCase()] ?? [key.toLowerCase()];
    const row = eq.find((e) => needles.some((n) => (e.nombre || "").toLowerCase().includes(n)));
    return row?.id ?? null;
  };
}

/** Parte un texto de instrumentos ("requinto, bass") en lista limpia. */
export function parseInstrumentos(v: unknown): string[] {
  return String(v || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

interface FilaPlantilla {
  orden: number;
  clase: string;
  titulo: string;
  resp: string | null;
  responsable_id: string | null;
  subs: string[] | null;
}

/**
 * La plantilla de ese tipo, leída de la base.
 *
 * Devuelve `null` —no una lista vacía— cuando no hay NADA configurado, para que
 * el llamador sepa que tiene que caer a la de fábrica. La diferencia importa:
 * una plantilla que sólo tiene el hueco de instrumentos y una venta sin
 * instrumentos da una lista vacía LEGÍTIMA, y ahí no hay que caer a nada.
 */
async function plantillaDeBase(
  sb: SupabaseClient,
  tipo: string | undefined,
  instrumentos: string[],
): Promise<TplTarea[] | null> {
  if (!tipo) return null;
  try {
    const { data, error } = await sb
      .from("tarea_plantilla_items")
      .select("orden, clase, titulo, resp, responsable_id, subs")
      .eq("tipo", tipo)
      .order("orden", { ascending: true });
    if (error || !data || !data.length) return null;

    const out: TplTarea[] = [];
    for (const f of data as unknown as FilaPlantilla[]) {
      if (f.clase === "instrumentos") {
        // El hueco: aquí se expanden las tareas de los instrumentos vendidos, en
        // el lugar donde una persona lo puso — no al final.
        for (const i of instrumentos) {
          out.push({
            titulo: (f.titulo || "Grabar {instrumento}").replace(/\{instrumento\}/gi, i),
            resp: f.resp ?? undefined,
            respId: f.responsable_id,
            instrumento: i,
          });
        }
        continue;
      }
      out.push({
        titulo: f.titulo,
        resp: f.resp ?? undefined,
        respId: f.responsable_id,
        subs: f.subs ?? undefined,
      });
    }
    return out;
  } catch {
    // Tabla inexistente o Supabase caído: que decida la de fábrica.
    return null;
  }
}

/**
 * Crea las tareas (y subtareas) de un proyecto a partir de la plantilla de su
 * tipo, asignando responsables. Best-effort: no lanza.
 *
 * Devuelve qué tarea quedó para cada instrumento. Lo usa `habilitarPortal` para
 * colgar ahí la asignación del músico: antes lo resolvía volviendo a buscar la
 * tarea por su título ("Grabar Charchetas"), y desde que las plantillas se
 * editan desde el panel ese título puede cambiar — con lo que las asignaciones
 * habrían nacido sin tarea, y el músico sin fecha límite, en silencio.
 */
export async function crearTareasDeProyecto(
  sb: SupabaseClient,
  proyectoId: string,
  tipo: string | undefined,
  instrumentos: string[]
): Promise<Map<string, string>> {
  const porInstrumento = new Map<string, string>();
  const tpl = (await plantillaDeBase(sb, tipo, instrumentos)) ?? plantillaTareas(tipo, instrumentos);
  if (!tpl.length) return porInstrumento;

  const { data: eq } = await sb.from("equipo").select("id, nombre");
  const findId = resolverEquipo((eq ?? []) as { id: string; nombre: string }[]);

  const rows = tpl.map((t, i) => ({
    proyecto_id: proyectoId,
    titulo: t.titulo,
    // El id explícito gana sobre el alias: el alias casa por parecido de nombre
    // y con alguien nuevo en el equipo puede resolver a null sin avisar.
    responsable_id: t.respId ?? (t.resp ? findId(t.resp) : null),
    orden: i,
    hecho: false,
  }));
  const { data: ins } = await sb.from("proyecto_tareas").insert(rows).select("id, orden");

  const ordenToId = new Map<number, string>();
  for (const r of ins ?? []) ordenToId.set(Number(r.orden), r.id as string);

  const subRows: { tarea_id: string; titulo: string; orden: number; hecho: boolean }[] = [];
  tpl.forEach((t, i) => {
    const tid = ordenToId.get(i);
    if (!tid) return;
    if (t.instrumento) porInstrumento.set(t.instrumento, tid);
    if (t.subs?.length) t.subs.forEach((st, j) => subRows.push({ tarea_id: tid, titulo: st, orden: j, hecho: false }));
  });
  if (subRows.length) await sb.from("proyecto_subtareas").insert(subRows);

  return porInstrumento;
}
