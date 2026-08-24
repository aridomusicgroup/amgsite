// Indicadores de tiempo de entrega: cuánto tardamos desde que se genera la
// VENTA hasta que el proyecto se mueve a "entregado" en Producción.
//
// La clasificación cliente/interno reusa `esProyectoDeCliente` (pedido-sync) para
// que los números cuadren con el resto del panel — no se reinventa la regla.
import { esProyectoDeCliente } from "./pedido-sync";

/** Proyecto aplanado para medir entregas (lo arma getDashboardData). */
export interface DashProyecto {
  id: string;
  folio: string | null;
  titulo: string;
  tipo: string | null;
  estado: string;
  /** Trabajo pagado por un cliente (no contenido propio, beats de catálogo ni interno). */
  esCliente: boolean;
  /** Fecha de la venta ligada, si hay. Es el arranque real del reloj del cliente. */
  fechaVenta: string | null;
  /** created_at en YYYY-MM-DD (fallback cuando no hay venta). */
  creado: string;
  /** Entrega comprometida. */
  fechaEntrega: string | null;
  /** Entrega real: se sella sola al mover a entregado/cerrado. */
  fechaEntregaReal: string | null;
}

/** Estados que ya no consumen tiempo (el proyecto salió del tablero). */
const CERRADOS = ["entregado", "cerrado"];
/**
 * Estados en los que un proyecto ya NO está abierto. Se exporta porque también
 * define a quién NO se le ofrece recompra: si todavía le debemos trabajo, no es
 * momento de venderle lo siguiente.
 */
export const ESTADOS_NO_ABIERTOS = [...CERRADOS, "cancelado"];
const FUERA = ESTADOS_NO_ABIERTOS;

/** Arranque del reloj: la venta si existe, si no la creación del proyecto. */
export function inicioDe(p: DashProyecto): { fecha: string | null; fuente: "venta" | "creado" } {
  if (p.fechaVenta) return { fecha: p.fechaVenta, fuente: "venta" };
  return { fecha: p.creado || null, fuente: "creado" };
}

const dias = (desde: string, hasta: string) =>
  Math.round((new Date(hasta + "T12:00:00").getTime() - new Date(desde + "T12:00:00").getTime()) / 86400000);

export interface EntregaItem {
  p: DashProyecto;
  dias: number;
  fuente: "venta" | "creado";
  /** null si el proyecto no tenía fecha comprometida. */
  aTiempo: boolean | null;
}

export interface WipItem { p: DashProyecto; edad: number; fuente: "venta" | "creado" }

export interface EntregasResumen {
  entregas: EntregaItem[];
  n: number;
  /** Métrica principal: con muestras chicas el promedio miente, la mediana no. */
  mediana: number | null;
  promedio: number | null;
  p90: number | null;
  min: number | null;
  max: number | null;
  /** % que llegó en o antes de la fecha comprometida (solo los que tenían fecha). */
  pctATiempo: number | null;
  conFechaComprometida: number;
  /** Días promedio de retraso de los que llegaron tarde. */
  retrasoProm: number | null;
  /** Cuántas mediciones arrancan en la venta (vs. fallback a creación). */
  desdeVenta: number;
  porMes: { label: string; value: number }[];
  porTipo: { label: string; value: number; sub?: string }[];
  wip: WipItem[];
  wipEdadMax: number | null;
}

const mediana = (a: number[]): number | null => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length / 2;
  return s.length % 2 ? s[Math.floor(m)] : (s[m - 1] + s[m]) / 2;
};

const percentil = (a: number[], q: number): number | null => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(s.length * q) - 1))];
};

const prom = (a: number[]): number | null => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

const mesCorto = (ym: string) =>
  new Date(ym + "-15T12:00:00").toLocaleDateString("es-MX", { month: "short" });

/**
 * Calcula todos los indicadores de entrega para una lista ya filtrada
 * (cliente / interno / todos). `hoy` se inyecta para poder testear.
 */
export function calcEntregas(lista: DashProyecto[], hoy = new Date().toISOString().slice(0, 10)): EntregasResumen {
  const entregas: EntregaItem[] = [];

  for (const p of lista) {
    if (!CERRADOS.includes(p.estado) || !p.fechaEntregaReal) continue;
    const { fecha, fuente } = inicioDe(p);
    if (!fecha) continue;
    const d = dias(fecha, p.fechaEntregaReal);
    if (d < 0) continue; // dato inconsistente (entrega antes de la venta) → se ignora
    entregas.push({
      p, dias: d, fuente,
      aTiempo: p.fechaEntrega ? p.fechaEntregaReal <= p.fechaEntrega : null,
    });
  }

  const ds = entregas.map((e) => e.dias);
  const conFecha = entregas.filter((e) => e.aTiempo !== null);
  const tarde = conFecha.filter((e) => e.aTiempo === false);
  const retrasos = tarde
    .map((e) => (e.p.fechaEntrega ? dias(e.p.fechaEntrega, e.p.fechaEntregaReal as string) : 0))
    .filter((d) => d > 0);

  // Tendencia: mediana de días por mes de ENTREGA (últimos 12).
  const porMesMap = new Map<string, number[]>();
  for (const e of entregas) {
    const k = (e.p.fechaEntregaReal as string).slice(0, 7);
    porMesMap.set(k, [...(porMesMap.get(k) ?? []), e.dias]);
  }
  const porMes = [...porMesMap.keys()].sort().slice(-12)
    .map((k) => ({ label: mesCorto(k), value: mediana(porMesMap.get(k) as number[]) ?? 0 }));

  const porTipoMap = new Map<string, number[]>();
  for (const e of entregas) {
    const k = e.p.tipo ?? "Sin tipo";
    porTipoMap.set(k, [...(porTipoMap.get(k) ?? []), e.dias]);
  }
  const porTipo = [...porTipoMap.entries()]
    .map(([label, arr]) => ({ label, value: mediana(arr) ?? 0, sub: `${arr.length}` }))
    .sort((a, b) => b.value - a.value);

  // WIP: lo que sigue abierto y cuánto lleva esperando.
  const wip: WipItem[] = [];
  for (const p of lista) {
    if (FUERA.includes(p.estado)) continue;
    const { fecha, fuente } = inicioDe(p);
    if (!fecha) continue;
    wip.push({ p, edad: Math.max(0, dias(fecha, hoy)), fuente });
  }
  wip.sort((a, b) => b.edad - a.edad);

  return {
    entregas, n: entregas.length,
    mediana: mediana(ds), promedio: prom(ds), p90: percentil(ds, 0.9),
    min: ds.length ? Math.min(...ds) : null,
    max: ds.length ? Math.max(...ds) : null,
    pctATiempo: conFecha.length ? (conFecha.filter((e) => e.aTiempo).length / conFecha.length) * 100 : null,
    conFechaComprometida: conFecha.length,
    retrasoProm: prom(retrasos),
    desdeVenta: entregas.filter((e) => e.fuente === "venta").length,
    porMes, porTipo,
    wip, wipEdadMax: wip.length ? wip[0].edad : null,
  };
}

/** Reexporta la regla para que la UI clasifique con el MISMO criterio. */
export { esProyectoDeCliente };
