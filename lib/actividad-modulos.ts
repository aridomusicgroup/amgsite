// A qué módulo pertenece cada movimiento de la bitácora, y a dónde lleva al
// tocarlo.
//
// Módulo PURO: lo usan la campanita (navegador) y la API que la alimenta
// (servidor). Si cada uno decidiera por su cuenta, la campanita de Clientes
// contaría cosas que luego no aparecen en su lista.
//
// OJO con cómo se identifica Producción: sus eventos son los más viejos del
// panel y NO llenan `entidad` — se identifican por `proyecto_id` / `tarea_id`.
// Por eso la regla no puede ser solo "entidad = tal".

/** Módulo al que pertenece el movimiento (para filtrar la bitácora). */
export type ActividadEntidad =
  | "proyecto" | "tarea" | "venta" | "pago" | "cotizacion"
  | "contrato" | "contacto" | "egreso" | "ingreso" | "gasto_recurrente" | "usuario" | "musico"
  | "almacenamiento";

/**
 * Entidades de dinero/comercial: solo las ven los admins.
 *
 * Vive aquí, en el módulo puro, y no en `lib/actividad.ts`, porque ese es
 * `server-only` y esta lista la necesita también quien arma consultas desde
 * archivos que el navegador termina importando (aunque sea solo por tipos).
 */
export const ENTIDADES_SENSIBLES: ActividadEntidad[] = ["venta", "pago", "egreso", "ingreso", "gasto_recurrente", "cotizacion", "contrato", "usuario", "musico"];

export type Modulo = "produccion" | "clientes" | "finanzas";

/** Lo mínimo de un renglón de bitácora para saber a dónde pertenece. */
export interface ItemActividad {
  id: string;
  tipo: string;
  titulo: string;
  proyecto_id: string | null;
  tarea_id: string | null;
  entidad: string | null;
  entidad_id: string | null;
  entidad_nombre: string | null;
  actor: string | null;
  created_at: string;
}

/** Entidades que sí llenan la columna, por módulo. */
export const ENTIDADES_DE: Record<Modulo, string[]> = {
  produccion: ["proyecto", "tarea"],
  clientes: ["contacto", "cotizacion", "contrato"],
  finanzas: ["egreso", "ingreso", "gasto_recurrente", "musico"],
};

export function moduloDe(it: ItemActividad): Modulo | null {
  if (it.proyecto_id || it.tarea_id) return "produccion";
  if (it.entidad && ENTIDADES_DE.produccion.includes(it.entidad)) return "produccion";
  if (it.entidad && ENTIDADES_DE.clientes.includes(it.entidad)) return "clientes";
  if (it.entidad && ENTIDADES_DE.finanzas.includes(it.entidad)) return "finanzas";
  return null; // ventas, pagos, accesos, etc.: viven en la bitácora completa, no en una campanita
}

/**
 * A dónde lleva tocar el aviso. `destacar` es lo que hace que la pantalla de
 * destino abra ESO y le prenda el resplandor — sin él, caerías en la lista
 * completa a buscar de qué te estaban hablando.
 */
export function destinoDe(it: ItemActividad): string {
  if (it.tarea_id) return `/admin/produccion?destacar=${it.tarea_id}`;
  if (it.proyecto_id) return `/admin/produccion?destacar=${it.proyecto_id}`;

  switch (it.entidad) {
    case "proyecto":
    case "tarea":
      return it.entidad_id ? `/admin/produccion?destacar=${it.entidad_id}` : "/admin/produccion";
    case "contacto":
      return it.entidad_id ? `/admin/clientes?destacar=${it.entidad_id}` : "/admin/clientes";
    // Cotizaciones y contratos tienen su propia pantalla; se abre el módulo,
    // todavía sin resplandor adentro.
    case "cotizacion":
    case "contrato":
      return "/admin/cotizaciones";
    // Egresos/ingresos viven en una lista sin anclas propias todavía: se abre
    // el módulo, sin resplandor.
    case "egreso":
    case "ingreso":
    case "gasto_recurrente":
    case "musico":
      return "/admin/finanzas";
    default:
      return "/admin/actividad";
  }
}

/** Color del punto por tipo de evento (la campanita y la bitácora comparten). */
export const DOT_ACTIVIDAD: Record<string, string> = {
  proyecto_creado: "bg-green-400",
  proyecto_estado: "bg-blue-400",
  proyecto_responsables: "bg-purple-400",
  tarea_creada: "bg-white/50",
  tarea_asignada: "bg-amber-400",
  tarea_completada: "bg-green-400",
  tarea_reabierta: "bg-white/40",
  subtarea_asignada: "bg-amber-400",
  contacto_creado: "bg-green-400",
  contacto_editado: "bg-blue-400",
  contacto_eliminado: "bg-red-400",
  recompra_enviada: "bg-green-400",
  seguimiento_programado: "bg-amber-400",
  seguimiento_cerrado: "bg-white/40",
  cotizacion_enviada: "bg-amber-400",
  contrato_enviado: "bg-amber-400",
  pago_recurrente_pendiente: "bg-red-400",
  pago_musico_pendiente: "bg-red-400",
};
