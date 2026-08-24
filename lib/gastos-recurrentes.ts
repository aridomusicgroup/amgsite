/**
 * Infiere gastos recurrentes (renta, suscripciones, servicios…) a partir del
 * historial de `egresos` — no hay una tabla de "gastos fijos" que el staff
 * llene a mano, se deduce de lo que ya se ha ido registrando cada mes.
 *
 * Módulo PURO: sin base de datos, para poder probarlo solo. El cron
 * (`/api/cron/pagos-recurrentes`) es quien lo conecta con Supabase y los avisos.
 */

export interface EgresoLite {
  fecha: string; // ISO yyyy-mm-dd
  categoria: string | null;
  proveedor: string | null;
  descripcion: string | null;
  total_mxn: number;
  es_capex: boolean;
}

export interface GastoRecurrente {
  /** Estable entre corridas — identifica el mismo gasto mes a mes. */
  clave: string;
  etiqueta: string;
  montoEstimado: number;
  vecesVisto: number;
  ultimaFecha: string;
  proximaFecha: string; // ISO yyyy-mm-dd
  /** "explicito" = viene de un registro a mano en `gastos_recurrentes`; ausente = detectado del patrón de egresos. */
  origen?: "explicito";
}

/** Un pago recurrente dado de alta a mano (tabla `gastos_recurrentes`). */
export interface GastoRecurrenteRegistrado {
  id: string;
  nombre: string;
  categoria: string | null;
  proveedor: string | null;
  montoEstimado: number;
  diaMes: number; // 1-31
  activo: boolean;
}

const MS_DIA = 24 * 60 * 60 * 1000;

const normaliza = (s: string | null | undefined): string => (s || "").trim().toLowerCase();

function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function aISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Mismo día del mes, un mes después — recorta al último día si ese mes es más corto (31 ene → 28/29 feb). */
function unMesDespues(iso: string): string {
  const d = aFecha(iso);
  const dia = d.getDate();
  const siguiente = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const ultimoDiaMes = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
  siguiente.setDate(Math.min(dia, ultimoDiaMes));
  return aISO(siguiente);
}

/**
 * Agrupa por categoría+proveedor (o categoría+descripción si no hay
 * proveedor) y se queda con los grupos donde las últimas dos ocurrencias
 * caen a 20-40 días de distancia — el margen de un "mes" con algo de
 * tolerancia (rentas que se pagan un poco antes o después, fines de semana).
 * Excluye `es_capex` (equipo/gear: inversión, no es un gasto que se repita).
 */
export function detectarRecurrentes(egresos: EgresoLite[]): GastoRecurrente[] {
  const grupos = new Map<string, { etiqueta: string; fechas: string[]; montos: number[] }>();

  for (const e of egresos) {
    if (e.es_capex) continue;
    if (!e.categoria && !e.proveedor && !e.descripcion) continue;
    const cat = normaliza(e.categoria);
    const quien = normaliza(e.proveedor) || normaliza(e.descripcion);
    if (!cat && !quien) continue;
    const clave = `${cat}::${quien}`;

    const etiqueta = [e.categoria, e.proveedor].filter(Boolean).join(" · ") || e.descripcion || e.categoria || "Gasto";
    const g = grupos.get(clave) ?? { etiqueta, fechas: [], montos: [] };
    g.fechas.push(e.fecha);
    g.montos.push(Number(e.total_mxn) || 0);
    grupos.set(clave, g);
  }

  const recurrentes: GastoRecurrente[] = [];
  for (const [clave, g] of grupos) {
    if (g.fechas.length < 2) continue;
    const fechasOrdenadas = [...g.fechas].sort();
    const ultima = fechasOrdenadas[fechasOrdenadas.length - 1];
    const penultima = fechasOrdenadas[fechasOrdenadas.length - 2];
    const gapDias = Math.round((aFecha(ultima).getTime() - aFecha(penultima).getTime()) / MS_DIA);
    if (gapDias < 20 || gapDias > 40) continue; // no se ve mensual

    recurrentes.push({
      clave,
      etiqueta: g.etiqueta,
      // El último monto pagado predice mejor el próximo que un promedio
      // histórico (las suscripciones/rentas suben de precio, no bajan).
      montoEstimado: g.montos[g.fechas.indexOf(ultima)] ?? g.montos[g.montos.length - 1],
      vecesVisto: g.fechas.length,
      ultimaFecha: ultima,
      proximaFecha: unMesDespues(ultima),
    });
  }

  return recurrentes.sort((a, b) => a.proximaFecha.localeCompare(b.proximaFecha));
}

/** Los que vencen dentro de `diasAntes` días, o que ya se pasaron de fecha (nadie lo registró todavía). */
export function pagosPendientes(recurrentes: GastoRecurrente[], hoyISO: string, diasAntes = 5): GastoRecurrente[] {
  const limite = aISO(new Date(aFecha(hoyISO).getTime() + diasAntes * MS_DIA));
  return recurrentes.filter((r) => r.proximaFecha <= limite);
}

/** Ciclo (año-mes) al que pertenece un aviso — para no duplicar la campanita cada día que corre el cron. */
export const cicloDe = (proximaFechaISO: string): string => proximaFechaISO.slice(0, 7);

function ultimoDiaDelMes(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/** Ocurrencia de `diaMes` en el mes de `iso` (recortada a fin de mes). */
function ocurrenciaEnMesDe(diaMes: number, iso: string): string {
  const d = aFecha(iso);
  const y = d.getFullYear(), m = d.getMonth();
  return aISO(new Date(y, m, Math.min(diaMes, ultimoDiaDelMes(y, m))));
}

/**
 * Ocurrencia de `diaMes` en el mes SIGUIENTE al de `desdeISO` — no el mes
 * siguiente al día exacto. Si alguien paga unos días antes de la fecha
 * (pagó Google One el 5, el cargo real es el 7), ese pago sigue cerrando el
 * ciclo de ESE mes; comparar por día exacto lo dejaba "sin pagar" y el aviso
 * no se apagaba nunca aunque ya se hubiera registrado el pago.
 */
function siguienteOcurrencia(diaMes: number, desdeISO: string): string {
  const d = aFecha(desdeISO);
  const y = d.getFullYear(), m = d.getMonth() + 1;
  return aISO(new Date(y, m, Math.min(diaMes, ultimoDiaDelMes(y, m))));
}

/**
 * Próximo vencimiento de un registro EXPLÍCITO: si ya se pagó antes, la
 * siguiente ocurrencia después del último pago; si nunca se ha pagado, la
 * ocurrencia de ESTE mes (aunque ya haya pasado — así avisa desde el día uno,
 * sin necesitar 2+ pagos de historial como sí requiere la inferencia).
 */
export function proximoVencimiento(diaMes: number, ultimaPagadaISO: string | null, hoyISO: string): string {
  if (ultimaPagadaISO) return siguienteOcurrencia(diaMes, ultimaPagadaISO);
  return ocurrenciaEnMesDe(diaMes, hoyISO);
}

/**
 * Misma clave que usa `detectarRecurrentes`: categoría + (proveedor o el
 * propio nombre/descripción). Exportada a propósito: `lib/gastos-recurrentes
 * -data.ts` la reusa para "¿ya se pagó?" — antes tenía su PROPIA copia y se
 * desalineó con esta (bug real: Google One quedaba "pagado" para el cron
 * pero seguía "pendiente" en el panel, porque cada lado normalizaba distinto
 * cuándo categoría/proveedor venían vacíos).
 */
export function claveDe(categoria: string | null, proveedorODescripcion: string | null): string {
  return `${normaliza(categoria)}::${normaliza(proveedorODescripcion)}`;
}

/**
 * Combina lo registrado a mano con lo inferido, PURO (sin DB): lo registrado
 * gana para su clave (evita aviso doble de lo mismo) y no depende de que ya
 * se haya capturado 2 veces. Un registro pausado (`activo=false`) tampoco
 * deja pasar la inferencia para esa clave — se pausó a propósito.
 */
export function combinarConRegistrados(
  registrados: GastoRecurrenteRegistrado[],
  egresos: EgresoLite[],
  hoyISO: string,
): GastoRecurrente[] {
  const clavesRegistradas = new Set<string>();
  const explicitos: GastoRecurrente[] = [];

  for (const r of registrados) {
    const clave = claveDe(r.categoria, r.proveedor || r.nombre);
    clavesRegistradas.add(clave);
    if (!r.activo) continue;

    let ultimaPagada: string | null = null;
    for (const e of egresos) {
      if (e.es_capex) continue;
      if (claveDe(e.categoria, e.proveedor || e.descripcion) !== clave) continue;
      if (!ultimaPagada || e.fecha > ultimaPagada) ultimaPagada = e.fecha;
    }

    explicitos.push({
      clave,
      etiqueta: [r.categoria, r.proveedor].filter(Boolean).join(" · ") || r.nombre,
      montoEstimado: r.montoEstimado,
      vecesVisto: ultimaPagada ? 1 : 0,
      ultimaFecha: ultimaPagada ?? "",
      proximaFecha: proximoVencimiento(r.diaMes, ultimaPagada, hoyISO),
      origen: "explicito",
    });
  }

  const inferidos = detectarRecurrentes(egresos).filter((g) => !clavesRegistradas.has(g.clave));
  return [...explicitos, ...inferidos].sort((a, b) => a.proximaFecha.localeCompare(b.proximaFecha));
}
