import type { SupabaseClient } from "@supabase/supabase-js";
import { PASOS_CANCION_FABRICA, TIPO_CANCION } from "@/lib/cancion-plantilla";
import { esPaso, pasoDeTitulo, type PasoEntrega } from "@/lib/pasos-entrega";

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
  /** "Aprobada" o "Subir a Drive": los dos pasos que mueven la entrega automática. */
  paso?: PasoEntrega | null;
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
 * El cierre de toda producción de cliente: alguien la aprueba y se sube.
 * Con estos dos marcados, palomear la aprobación abre el cuadro de entrega.
 */
const APROBADA: TplTarea = { titulo: "Aprobada", resp: "luis", paso: "aprobacion" };
const SUBIR = (resp: string): TplTarea => ({ titulo: "Subir a Drive", resp, paso: "entrega" });

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
        APROBADA,
        { ...SUBIR("diego"), titulo: "Subir archivos a Drive" },
      ];
    case "mezcla_master":
      return [{ titulo: "Editar y cuantizar", resp: "diego", subs: SUBS_EDITAR }, APROBADA, SUBIR("luis")];
    case "beat_personalizado":
      return [
        { titulo: "Hacer maqueta", resp: "eliud" },
        ...grabar,
        { titulo: "Editar y cuantizar", resp: "diego", subs: SUBS_EDITAR },
        { titulo: "Mezclar", resp: "luis" },
        { titulo: "Masterizar", resp: "luis" },
        APROBADA,
        SUBIR("luis"),
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
  paso?: string | null;
}

/**
 * Inserta filas; si la base todavía no tiene una columna nueva (`paso`, o
 * `responsable_id` en subtareas de esquemas viejos), reintenta sin ella.
 * Mejor tareas sin la marca que un proyecto que nace sin tareas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertarTolerante(sb: SupabaseClient, tabla: string, filas: Record<string, unknown>[], select?: string): Promise<{ data: any[] | null; error: unknown }> {
  const intento = (fs: Record<string, unknown>[]) =>
    select ? sb.from(tabla).insert(fs).select(select) : sb.from(tabla).insert(fs);
  let actuales = filas;
  let r = await intento(actuales);
  for (const col of ["paso", "responsable_id"]) {
    if (!r.error) break;
    actuales = actuales.map((f) => {
      const { [col]: _fuera, ...resto } = f;
      return resto;
    });
    r = await intento(actuales);
  }
  return { data: (r.data as unknown[] | null) as never, error: r.error };
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
    const consulta = (cols: string) =>
      sb.from("tarea_plantilla_items").select(cols).eq("tipo", tipo).order("orden", { ascending: true });
    // `paso` es columna nueva: sin la migración se pide sin ella.
    let { data, error } = await consulta("orden, clase, titulo, resp, responsable_id, subs, paso");
    if (error) ({ data, error } = await consulta("orden, clase, titulo, resp, responsable_id, subs"));
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
        paso: esPaso(f.paso) ? f.paso : pasoDeTitulo(f.titulo),
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
  instrumentos: string[],
  /**
   * Desde qué número de orden empezar. En un EP las tareas del disco van
   * DESPUÉS de los temas; sin esto las dos tandas empezaban en 0 y el tablero
   * las intercalaba en un orden que dependía de la base.
   */
  ordenBase = 0,
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
    orden: ordenBase + i,
    hecho: false,
    paso: t.paso ?? pasoDeTitulo(t.titulo),
  }));
  const { data: ins } = await insertarTolerante(sb, "proyecto_tareas", rows, "id, orden");

  const ordenToId = new Map<number, string>();
  for (const r of ins ?? []) ordenToId.set(Number(r.orden), r.id as string);

  const subRows: Record<string, unknown>[] = [];
  tpl.forEach((t, i) => {
    const tid = ordenToId.get(ordenBase + i);
    if (!tid) return;
    if (t.instrumento) porInstrumento.set(t.instrumento, tid);
    if (t.subs?.length) {
      t.subs.forEach((st, j) => subRows.push({ tarea_id: tid, titulo: st, orden: j, hecho: false, paso: pasoDeTitulo(st) }));
    }
  });
  if (subRows.length) await insertarTolerante(sb, "proyecto_subtareas", subRows);

  return porInstrumento;
}

/**
 * Los pasos de UN tema: la plantilla `_cancion` guardada en Ajustes, o la de
 * fábrica si nadie ha guardado una. Con los instrumentos ya expandidos.
 */
async function pasosDeCancion(sb: SupabaseClient, instrumentos: string[]): Promise<TplTarea[]> {
  const deBase = await plantillaDeBase(sb, TIPO_CANCION, instrumentos);
  if (deBase) return deBase;
  const out: TplTarea[] = [];
  for (const p of PASOS_CANCION_FABRICA) {
    if (p.clase === "instrumentos") {
      for (const i of instrumentos) {
        out.push({ titulo: p.titulo.replace(/\{instrumento\}/gi, i), resp: p.resp ?? undefined, instrumento: i });
      }
    } else {
      out.push({ titulo: p.titulo, resp: p.resp ?? undefined, paso: p.paso ?? null });
    }
  }
  return out;
}

/**
 * Crea un EP o álbum: una tarea por tema, y DENTRO de cada una sus pasos como
 * subtareas. Luego las tareas del disco completo, si esa plantilla tiene.
 *
 * Es la ÚNICA puerta para crear temas. Antes había tres caminos y hacían tres
 * cosas distintas:
 *
 *   venta / convertir cotización → tareas por tema, SIN subtareas
 *   proyecto manual              → tareas por tema, SIN subtareas
 *   cotización pagada por Stripe → subtareas, pero temas SIN `es_cancion`
 *                                  y los pasos fijos en el código
 *
 * Y el único que creaba subtareas era el que ningún EP había usado. Los tres EP
 * que existían (P0044, P0021, P0004) tenían subtareas en todos sus temas porque
 * alguien las había escrito A MANO, tema por tema: se crearon horas y hasta una
 * semana después del proyecto, con dedazos, y distintas en cada tema.
 *
 * Best-effort como `crearTareasDeProyecto`: la venta o el proyecto ya se
 * guardaron y no se pierden por esto.
 */
export async function crearTareasDeCanciones(
  sb: SupabaseClient,
  proyectoId: string,
  tipo: string | undefined,
  canciones: string[],
  instrumentos: string[],
  responsableId: string | null,
): Promise<void> {
  if (!canciones.length) return;
  try {
    const { data: temas } = await sb
      .from("proyecto_tareas")
      .insert(canciones.map((titulo, i) => ({
        proyecto_id: proyectoId, titulo, responsable_id: responsableId,
        orden: i, es_cancion: true, hecho: false,
      })))
      .select("id");

    const pasos = await pasosDeCancion(sb, instrumentos);
    if (pasos.length && temas?.length) {
      const { data: eq } = await sb.from("equipo").select("id, nombre");
      const findId = resolverEquipo((eq ?? []) as { id: string; nombre: string }[]);
      const subRows = temas.flatMap((t) => pasos.map((p, j) => ({
        tarea_id: t.id as string,
        titulo: p.titulo,
        orden: j,
        hecho: false,
        // Cada paso con su responsable: la maqueta a quien graba, la edición a
        // quien cuantiza. Antes las subtareas a mano nacían sin nadie.
        responsable_id: p.respId ?? (p.resp ? findId(p.resp) : null),
        // "Aprobada" y "Subir a Drive" de cada tema: con ellos, aprobar un tema
        // abre su propio cuadro de entrega.
        paso: p.paso ?? pasoDeTitulo(p.titulo),
      })));
      await insertarTolerante(sb, "proyecto_subtareas", subRows);
    }

    // Las del disco completo (portada, distribución…) van después de los temas.
    // Sin plantilla de `ep`/`album` no nace ninguna, que es lo de siempre.
    await crearTareasDeProyecto(sb, proyectoId, tipo, [], canciones.length);
  } catch (e) {
    console.error("crearTareasDeCanciones:", e);
  }
}
