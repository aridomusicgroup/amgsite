import "server-only";
import { registrarActividad } from "@/lib/actividad";
import { esProyectoDeCliente } from "@/lib/pedido-sync";
import { pasoDe, type PasoEntrega } from "@/lib/pasos-entrega";
import { efectosDeCambioDeEstado } from "@/lib/proyecto-estado";
import { conRespaldo } from "@/lib/entrega";

/**
 * El proyecto cambia de columna solo, según avanzan sus tareas:
 *
 *   Cola          → nada hecho, o sólo la maqueta
 *   Producción    → ya se completó algo más que la maqueta
 *   En revisión   → está hecho todo menos "Aprobada" y "Subir a Drive"
 *   Entregado     → lo decide la entrega automática (lib/entrega.ts)
 *
 * SÓLO HACIA ADELANTE, a propósito:
 *   · una ronda de revisión agrega tareas nuevas sin hacer; si esto regresara
 *     el proyecto a Producción, abrir una ronda lo sacaría de Revisión;
 *   · si alguien acomodó la tarjeta a mano, desmarcar una palomita no se lo
 *     deshace.
 * Tampoco toca un proyecto en pausa, entregado, cerrado o cancelado.
 *
 * "En revisión" es sólo para proyectos de cliente: lo interno, el contenido y
 * los beats de catálogo no tienen a quién pedirle que revise, y se quedan en
 * Producción hasta que alguien los cierre.
 *
 * En un EP cuentan los PASOS de cada tema (sus subtareas), no el tema entero.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const ORDEN: Record<string, number> = { cola: 0, produccion: 1, revision: 2 };
const LABEL: Record<string, string> = { produccion: "Producción", revision: "En revisión" };
const MOTIVO: Record<string, string> = {
  produccion: "ya se completó trabajo más allá de la maqueta",
  revision: "sólo faltan la aprobación y subir a Drive",
};

const esMaqueta = (titulo: string) => /maqueta/i.test(titulo);

interface Paso { titulo: string; hecho: boolean; paso: PasoEntrega | null }

/** Las casillas que cuentan: las tareas, y en los temas de un EP, sus pasos. */
async function pasosDelProyecto(sb: SB, proyectoId: string): Promise<Paso[]> {
  const tareas = await conRespaldo(
    () => sb.from("proyecto_tareas").select("id, titulo, hecho, paso, es_cancion").eq("proyecto_id", proyectoId),
    () => sb.from("proyecto_tareas").select("id, titulo, hecho, es_cancion").eq("proyecto_id", proyectoId),
  );
  const temas = tareas.filter((t) => t.es_cancion).map((t) => t.id as string);
  const subs = temas.length
    ? await conRespaldo(
        () => sb.from("proyecto_subtareas").select("tarea_id, titulo, hecho, paso").in("tarea_id", temas),
        () => sb.from("proyecto_subtareas").select("tarea_id, titulo, hecho").in("tarea_id", temas),
      )
    : [];

  const out: Paso[] = [];
  for (const t of tareas) {
    const suyos = t.es_cancion ? subs.filter((s) => s.tarea_id === t.id) : [];
    if (suyos.length) {
      // Palomear el tema entero palomea todos sus pasos (así lo hace la ruta).
      for (const s of suyos) out.push({ titulo: String(s.titulo ?? ""), hecho: Boolean(s.hecho || t.hecho), paso: pasoDe(s) });
    } else {
      out.push({ titulo: String(t.titulo ?? ""), hecho: Boolean(t.hecho), paso: pasoDe(t) });
    }
  }
  return out;
}

/** La regla, sin base de datos. */
export function estadoSegunTareas(pasos: Paso[], esCliente: boolean): "cola" | "produccion" | "revision" {
  if (!pasos.length) return "cola";
  // Todo menos "Aprobada" y "Subir a Drive".
  const trabajo = pasos.filter((p) => !p.paso);
  if (esCliente && trabajo.some((p) => !esMaqueta(p.titulo)) && trabajo.every((p) => p.hecho)) return "revision";
  if (pasos.some((p) => p.hecho && !esMaqueta(p.titulo))) return "produccion";
  return "cola";
}

/**
 * Revisa y, si toca, mueve el proyecto. Devuelve el estado nuevo o null.
 * Best-effort: nunca estorba al palomeo que la llamó.
 */
export async function avanzarEstadoPorTareas(sb: SB, proyectoId: string, actor: string): Promise<string | null> {
  try {
    const { data: p } = await sb.from("proyectos").select("id, titulo, clase, tipo, estado").eq("id", proyectoId).maybeSingle();
    if (!p || ORDEN[p.estado as string] === undefined) return null;

    const nuevo = estadoSegunTareas(await pasosDelProyecto(sb, proyectoId), esProyectoDeCliente(p));
    if (ORDEN[nuevo] <= ORDEN[p.estado as string]) return null;

    // `.eq("estado", …)`: si alguien lo movió a mano en este mismo instante, gana esa persona.
    const { data: movido } = await sb.from("proyectos")
      .update({ estado: nuevo, updated_at: new Date().toISOString() })
      .eq("id", proyectoId).eq("estado", p.estado)
      .select("id");
    if (!movido?.length) return null;

    await efectosDeCambioDeEstado(sb, proyectoId, nuevo, p.estado as string, actor);
    await registrarActividad(sb, {
      tipo: "proyecto_estado",
      titulo: `“${p.titulo ?? "El proyecto"}” pasó a ${LABEL[nuevo]} solo: ${MOTIVO[nuevo]}`,
      actor, proyecto_id: proyectoId, meta: { de: p.estado, a: nuevo, automatico: true },
    });
    return nuevo;
  } catch {
    return null;
  }
}
