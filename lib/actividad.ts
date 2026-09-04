import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ENTIDADES_SENSIBLES, type ActividadEntidad } from "@/lib/actividad-modulos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type ActividadTipo =
  // Producción
  | "proyecto_creado" | "proyecto_estado" | "proyecto_responsables"
  | "tarea_creada" | "tarea_asignada" | "tarea_completada" | "tarea_reabierta"
  | "subtarea_asignada" | "contrato_auto"
  // Dinero
  | "venta_creada" | "venta_editada" | "venta_eliminada"
  | "pago_registrado" | "pago_editado" | "pago_eliminado"
  | "egreso_creado" | "egreso_editado" | "egreso_eliminado" | "pago_recurrente_pendiente"
  | "gasto_recurrente_creado" | "gasto_recurrente_editado" | "gasto_recurrente_eliminado"
  | "ingreso_creado" | "ingreso_eliminado"
  | "pago_musico_registrado" | "pago_musico_editado" | "pago_musico_eliminado" | "pago_musico_pendiente"
  // Comercial
  | "cotizacion_creada" | "cotizacion_editada" | "cotizacion_enviada" | "cotizacion_eliminada"
  | "contrato_creado" | "contrato_editado" | "contrato_enviado" | "contrato_eliminado"
  // CRM
  | "contacto_creado" | "contacto_editado" | "contacto_eliminado" | "recompra_enviada"
  | "seguimiento_programado" | "seguimiento_cerrado"
  // Equipo
  | "usuario_agregado" | "usuario_editado" | "usuario_eliminado"
  // Almacenamiento
  | "almacenamiento_tipo_editado" | "almacenamiento_override_editado";

// Se mudaron al módulo puro (lo importa el navegador); se re-exportan de aquí.
export { ENTIDADES_SENSIBLES };
export type { ActividadEntidad };

interface RegistrarInput {
  tipo: ActividadTipo;
  titulo: string; // mensaje legible ya formado
  actor?: string | null; // correo de quien lo hizo
  proyecto_id?: string | null;
  tarea_id?: string | null;
  /** Sobre qué fue: módulo + id + nombre legible (folio, título, cliente). */
  entidad?: ActividadEntidad | null;
  entidad_id?: string | null;
  entidad_nombre?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Bitácora del panel de Producción (best-effort). NUNCA lanza: si la tabla no
 * existe o falla el insert, la mutación principal sigue su curso.
 */
export async function registrarActividad(sb: SB, input: RegistrarInput): Promise<void> {
  try {
    await sb.from("actividad").insert({
      tipo: input.tipo,
      titulo: input.titulo,
      actor: input.actor ?? null,
      proyecto_id: input.proyecto_id ?? null,
      tarea_id: input.tarea_id ?? null,
      entidad: input.entidad ?? null,
      entidad_id: input.entidad_id ?? null,
      entidad_nombre: input.entidad_nombre ?? null,
      meta: input.meta ?? null,
    });
  } catch {
    /* bitácora best-effort */
  }
}

/** Retención: borra la bitácora con más de 6 meses. Best-effort, nunca lanza. */
export async function purgarActividadVieja(sb: SB): Promise<void> {
  try {
    const corte = new Date(Date.now() - 182 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from("actividad").delete().lt("created_at", corte);
  } catch {
    /* best-effort */
  }
}

/** Mapa id→nombre del equipo (para armar mensajes legibles). */
export async function nombresPorId(
  sb: SB,
  ids: (string | null | undefined)[]
): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!uniq.length) return {};
  try {
    const { data } = await sb.from("equipo").select("id, nombre").in("id", uniq);
    const map: Record<string, string> = {};
    for (const r of data ?? []) map[r.id] = (r.nombre as string) || "—";
    return map;
  } catch {
    return {};
  }
}

/** Nombre legible de quien ejecuta la acción (equipo por correo, o el correo). */
export async function nombreDeActor(sb: SB, email: string | null): Promise<string> {
  if (!email) return "Alguien";
  const correo = email.toLowerCase();
  // `usuarios` es la tabla de quien entra al panel y su nombre lo edita cada
  // quien desde Ajustes, así que manda sobre `equipo`, que es la nómina.
  try {
    const { data } = await sb.from("usuarios").select("nombre").eq("email", correo).limit(1);
    if (data?.[0]?.nombre) return data[0].nombre as string;
  } catch {
    /* sin tabla usuarios */
  }
  try {
    const { data } = await sb.from("equipo").select("nombre").eq("email", correo).limit(1);
    if (data?.[0]?.nombre) return data[0].nombre as string;
  } catch {
    /* sin equipo o sin columna email */
  }
  return email.split("@")[0];
}
