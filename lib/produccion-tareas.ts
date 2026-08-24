import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Motor de plantillas de tareas de producción — COMPARTIDO.
 * Lo usan tanto el panel de Producción (/api/admin/proyectos) como Ventas
 * (/api/admin/ventas, incluido "convertir cotización en venta"), para que un
 * proyecto nazca siempre con las mismas tareas ricas, subtareas y responsables.
 */

export type TplTarea = { titulo: string; resp?: string; subs?: string[] };

const SUBS_EDITAR = [
  "Cuantizar guitarras", "Cuantizar bass", "Eliminar ruidos",
  "Eliminar silencios", "Corregir empalmes", "Mandarlo a mezcla",
];

/** Tareas que dispara cada producción de catálogo (caen a Tozi). */
export const DISTRIBUCION = [
  "Subir a BeatStars", "Portada de YouTube", "Portada de BeatStars",
  "Subir archivos a Drive", "Actualizar catálogo",
];

/** Plantilla de tareas según el tipo de proyecto y los instrumentos elegidos. */
export function plantillaTareas(tipo: string | undefined, instrumentos: string[]): TplTarea[] {
  const grabar: TplTarea[] = instrumentos.map((i) => ({ titulo: `Grabar ${i}`, resp: "eliud" }));
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

/**
 * Crea las tareas (y subtareas) de un proyecto a partir de la plantilla de su
 * tipo, asignando responsables. Best-effort: no lanza.
 */
export async function crearTareasDeProyecto(
  sb: SupabaseClient,
  proyectoId: string,
  tipo: string | undefined,
  instrumentos: string[]
): Promise<void> {
  const tpl = plantillaTareas(tipo, instrumentos);
  if (!tpl.length) return;

  const { data: eq } = await sb.from("equipo").select("id, nombre");
  const findId = resolverEquipo((eq ?? []) as { id: string; nombre: string }[]);

  const rows = tpl.map((t, i) => ({
    proyecto_id: proyectoId,
    titulo: t.titulo,
    responsable_id: t.resp ? findId(t.resp) : null,
    orden: i,
    hecho: false,
  }));
  const { data: ins } = await sb.from("proyecto_tareas").insert(rows).select("id, orden");

  const ordenToId = new Map<number, string>();
  for (const r of ins ?? []) ordenToId.set(Number(r.orden), r.id as string);

  const subRows: { tarea_id: string; titulo: string; orden: number; hecho: boolean }[] = [];
  tpl.forEach((t, i) => {
    const tid = ordenToId.get(i);
    if (tid && t.subs?.length) t.subs.forEach((st, j) => subRows.push({ tarea_id: tid, titulo: st, orden: j, hecho: false }));
  });
  if (subRows.length) await sb.from("proyecto_subtareas").insert(subRows);
}
