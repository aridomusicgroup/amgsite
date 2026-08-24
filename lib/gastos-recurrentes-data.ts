import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { proximoVencimiento, claveDe, type EgresoLite } from "@/lib/gastos-recurrentes";

export interface GastoRecurrenteRow {
  id: string;
  nombre: string;
  categoria: string | null;
  proveedor: string | null;
  montoEstimado: number;
  diaMes: number;
  activo: boolean;
  notas: string | null;
  /** null si está pausado (no se calcula vencimiento para algo que no avisa). */
  proximaFecha: string | null;
  /** Vence dentro de 5 días o ya se venció y no se pagó este ciclo. */
  pendiente: boolean;
}

/**
 * Lista para el panel de Finanzas: los registros a mano (todos, incluidos los
 * pausados) con su próximo vencimiento ya calculado contra `egresos` — para
 * saber si ya se pagó este ciclo sin que el staff tenga que ir a revisar.
 * Vacía si la tabla aún no existe (SQL sin correr) — no truena Finanzas.
 */
export async function getGastosRecurrentesParaPanel(diasAntes = 5): Promise<GastoRecurrenteRow[]> {
  try {
    const sb = supabaseAdmin();
    const hoy = new Date().toISOString().slice(0, 10);
    const limite = new Date(Date.now() + diasAntes * 86400000).toISOString().slice(0, 10);

    const [{ data: registrados }, { data: egresosRaw }] = await Promise.all([
      sb.from("gastos_recurrentes").select("id, nombre, categoria, proveedor, monto_estimado, dia_mes, activo, notas").order("dia_mes", { ascending: true }),
      sb.from("egresos").select("fecha, categoria, proveedor, descripcion, total_mxn, es_capex").order("fecha", { ascending: true }).limit(2000),
    ]);
    const egresos = (egresosRaw ?? []) as EgresoLite[];

    return (registrados ?? []).map((r) => {
      const categoria = (r.categoria as string | null) ?? null;
      const proveedor = (r.proveedor as string | null) ?? null;
      const nombre = r.nombre as string;
      const activo = r.activo !== false;
      const diaMes = Number(r.dia_mes) || 1;

      if (!activo) {
        return {
          id: r.id as string, nombre, categoria, proveedor,
          montoEstimado: Number(r.monto_estimado) || 0, diaMes, activo, notas: (r.notas as string | null) ?? null,
          proximaFecha: null, pendiente: false,
        };
      }

      const clave = claveDe(categoria, proveedor || nombre);
      let ultimaPagada: string | null = null;
      for (const e of egresos) {
        if (e.es_capex) continue;
        if (claveDe(e.categoria, e.proveedor || e.descripcion) !== clave) continue;
        if (!ultimaPagada || e.fecha > ultimaPagada) ultimaPagada = e.fecha;
      }
      const proximaFecha = proximoVencimiento(diaMes, ultimaPagada, hoy);

      return {
        id: r.id as string, nombre, categoria, proveedor,
        montoEstimado: Number(r.monto_estimado) || 0, diaMes, activo, notas: (r.notas as string | null) ?? null,
        proximaFecha, pendiente: proximaFecha <= limite,
      };
    });
  } catch {
    return [];
  }
}
