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
  /** Cada cuántos meses toca: 1 = mensual, 2 = bimestral (la luz de CFE)… */
  cadaMeses: number;
  activo: boolean;
  notas: string | null;
  /** null si está pausado (no se calcula vencimiento para algo que no avisa). */
  proximaFecha: string | null;
  /** Vence dentro de 5 días o ya se venció y no se pagó este ciclo. */
  pendiente: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fila = Record<string, any>;

const COLS = "id, nombre, categoria, proveedor, monto_estimado, dia_mes, activo, notas";

/**
 * Los registros a mano. `cada_meses` es columna nueva (supabase-gastos-cada-
 * meses.sql): pedirla antes de que exista vacía la lista entera, así que se
 * pide con ella y, si falla, sin ella — todo queda mensual como antes.
 */
export async function leerGastosRegistrados(sb: SB, orden = false): Promise<Fila[]> {
  const q = (cols: string) => {
    const base = sb.from("gastos_recurrentes").select(cols);
    return orden ? base.order("dia_mes", { ascending: true }) : base;
  };
  const conCada = await q(`${COLS}, cada_meses`);
  if (!conCada.error) return (conCada.data ?? []) as Fila[];
  return ((await q(COLS)).data ?? []) as Fila[];
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

    const [registrados, { data: egresosRaw }] = await Promise.all([
      leerGastosRegistrados(sb, true),
      sb.from("egresos").select("fecha, categoria, proveedor, descripcion, total_mxn, es_capex").order("fecha", { ascending: true }).limit(2000),
    ]);
    const egresos = (egresosRaw ?? []) as EgresoLite[];

    return registrados.map((r) => {
      const categoria = (r.categoria as string | null) ?? null;
      const proveedor = (r.proveedor as string | null) ?? null;
      const nombre = r.nombre as string;
      const activo = r.activo !== false;
      const diaMes = Number(r.dia_mes) || 1;
      const cadaMeses = Number(r.cada_meses) || 1;
      const base = {
        id: r.id as string, nombre, categoria, proveedor,
        montoEstimado: Number(r.monto_estimado) || 0, diaMes, cadaMeses, activo,
        notas: (r.notas as string | null) ?? null,
      };

      if (!activo) return { ...base, proximaFecha: null, pendiente: false };

      const clave = claveDe(categoria, proveedor || nombre);
      let ultimaPagada: string | null = null;
      for (const e of egresos) {
        if (e.es_capex) continue;
        if (claveDe(e.categoria, e.proveedor || e.descripcion) !== clave) continue;
        if (!ultimaPagada || e.fecha > ultimaPagada) ultimaPagada = e.fecha;
      }
      const proximaFecha = proximoVencimiento(diaMes, ultimaPagada, hoy, cadaMeses);

      return { ...base, proximaFecha, pendiente: proximaFecha <= limite };
    });
  } catch {
    return [];
  }
}
