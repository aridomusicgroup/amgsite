import type { EstadoEntrega, JobEntrega } from "@/lib/pasos-entrega";

/**
 * De los renders crudos, cómo va la entrega de cada unidad (un proyecto, o un
 * tema de EP). Es lo que pinta la píldora del tablero.
 *
 * Módulo sin base de datos: `getProyectos` y `getProyectoDetalle` ya traen los
 * renders por su lado, y aquí sólo se ordenan.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = Record<string, any>;

const EN_VUELO = ["pendiente", "renderizando", "subiendo"];

export type ResumenEntrega = Pick<EstadoEntrega, "jobs" | "retenido" | "compartido">;

export const claveUnidad = (proyectoId: string, tareaId: string | null | undefined) => `${proyectoId}|${tareaId ?? ""}`;

/**
 * @param jobs  renders de entregables/stems (con `opciones`, `drive_urls`, `compartir`)
 * @param cola  TODOS los trabajos en vuelo, de cualquier tipo: la cola es una
 *              sola, y un previo de otro proyecto también va antes.
 */
export function mapaDeEntregas(jobs: Fila[], cola: Fila[]): Map<string, ResumenEntrega> {
  const porUnidad = new Map<string, Fila[]>();
  for (const j of jobs) {
    if (!(j.opciones as Fila | null)?.entrega?.lote) continue;
    const k = claveUnidad(j.proyecto_id, j.tarea_id);
    porUnidad.set(k, [...(porUnidad.get(k) ?? []), j]);
  }

  const enVuelo = cola.filter((c) => EN_VUELO.includes(c.estado));
  const out = new Map<string, ResumenEntrega>();
  for (const [k, lista] of porUnidad) {
    // Sólo el lote más reciente: un reintento deja atrás al que falló.
    const ordenados = [...lista].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const lote = ordenados[0].opciones.entrega.lote;
    const actuales = ordenados.filter((j) => j.opciones?.entrega?.lote === lote);

    const js: JobEntrega[] = actuales
      .map((j) => ({
        id: j.id as string,
        tipo: j.tipo as JobEntrega["tipo"],
        estado: j.estado as JobEntrega["estado"],
        antes: j.estado === "pendiente"
          ? enVuelo.filter((c) => c.id !== j.id && String(c.created_at) < String(j.created_at)).length
          : 0,
        enDrive: j.estado === "listo" && ((j.drive_urls as unknown[] | null) ?? []).length > 0,
      }))
      // Entregables primero: es el orden en que el cliente los espera.
      .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === "entregables" ? -1 : 1));

    const todos = js.length > 0 && js.every((j) => j.enDrive);
    const cerrado = actuales.some((j) => j.opciones?.entrega?.cerrado);
    const compartido = todos && actuales.every((j) => j.compartir);
    out.set(k, { jobs: js, compartido, retenido: todos && cerrado && !compartido });
  }
  return out;
}
