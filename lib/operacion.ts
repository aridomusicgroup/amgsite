/**
 * Cuánto vale un día de operación y cómo se compara con lo que entra.
 *
 * Módulo PURO (sin base de datos ni React) para poder probarlo solo. El costo
 * del día NO sale del historial de egresos: ahí faltan meses enteros por
 * capturar (ver la auditoría financiera) y saldría barato y falso. Sale de lo
 * configurado: lo que se le paga al equipo, los pagos recurrentes y el sueldo
 * escalonado de los socios. Lo capturado se usa para otra cosa: avisar cuánto
 * falta por registrar.
 */
import type { AjustesBolsas, MesFinanzas } from "./bolsas";
import type { EgresoLite } from "./gastos-recurrentes";

/** 365 / 12: un mes promedio, para convertir lo mensual en lo diario. */
export const DIAS_POR_MES = 30.4;
const SEMANAS_POR_MES = 52 / 12;
/** Un gasto detectado que no se paga hace más que esto ya no se cuenta como costo vivo. */
const VIVO_DIAS = 62;
/** Si de lo cobrado se va más que esto en músicos y comisiones, es un dato raro, no un negocio. */
const DIRECTOS_MAX = 0.9;
/** Porcentaje de directos cuando todavía no hay cobros de dónde sacarlo (~16% en músicos). */
const DIRECTOS_RESPALDO = 0.16;
const MESES_A_MOSTRAR = 6;
/** Con menos días que estos, el ritmo del mes en curso es ruido (una venta suelta lo mueve días enteros). */
const MIN_DIAS_PROYECCION = 5;
const MS_DIA = 24 * 60 * 60 * 1000;
/** Tolerancia al comparar pesos con decimales (el último centavo de un acumulado). */
const EPSILON = 1e-9;

const numero = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** Minúsculas y sin acentos: "Nómina" → "nomina". */
const sinAcentos = (s: string): string =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c < 0x300 || c > 0x36f; // fuera del bloque de acentos combinados
    })
    .join("")
    .toLowerCase();

/** Palabras sueltas de un nombre: "Paco Chávez" → ["paco", "chavez"]. */
const palabrasDe = (s: string | null | undefined): string[] => sinAcentos(s ?? "").split(/[^a-z0-9]+/).filter(Boolean);

/** Las palabras del más corto están todas en el más largo: "Paco" / "Paco Chávez". */
function sonParecidas(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  return corto.every((p) => largo.includes(p));
}

/** Hoy en hora de México (YYYY-MM-DD): el servidor corre en UTC y de noche ya estaría en otro día. */
export const hoyEnMexico = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

// ─── Lo que cuesta cada cosa al mes ──────────────────────────────────────────

/** Un pago por periodo ("$1,200 por semana") convertido a lo que cuesta al mes. */
export function mensualDe(pagoBase: number, periodicidad: string | null | undefined): number {
  const base = numero(pagoBase);
  if (base <= 0) return 0;
  if (periodicidad === "semanal") return base * SEMANAS_POR_MES;
  if (periodicidad === "quincenal") return base * 2;
  return base;
}

/** Días reales de un mes "YYYY-MM" (28 a 31). */
export function diasEnMes(mes: string): number {
  const [anio, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(anio, m, 0)).getUTCDate();
}

/** "2026-10" + n meses (n puede ser negativo). */
function mesMas(mes: string, n: number): string {
  const [anio, m] = mes.split("-").map(Number);
  const total = anio * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Un pago recurrente dado de alta a mano (tabla `gastos_recurrentes`). */
export interface RegistradoCosto {
  nombre: string;
  categoria?: string | null;
  proveedor?: string | null;
  montoEstimado: number;
  cadaMeses?: number;
  activo: boolean;
}
/** Un recurrente tal como lo entrega `combinarConRegistrados` (lo registrado + lo detectado del historial). */
export interface CombinadoCosto { etiqueta: string; montoEstimado: number; ultimaFecha: string; origen?: string }
export interface RecurrenteCosto { concepto: string; mensual: number }

/** Categorías que ya viven en otro lado: la nómina en el equipo; músicos y comisiones en los directos. */
const CATEGORIAS_APARTE = ["nomina", "comision", "pago musico"];

const cadaMesesSano = (cada: number | undefined): number => Math.min(12, Math.max(1, Math.trunc(numero(cada)) || 1));

/**
 * ¿Este gasto detectado del historial es en realidad uno de los registrados a
 * mano? Misma categoría y proveedor parecido ("Paco" / "Paco Chávez"), aunque
 * el monto haya cambiado: contarlo de nuevo inflaría el costo sin avisar.
 */
function esDeRegistrado(c: CombinadoCosto, r: RegistradoCosto): boolean {
  const categoria = sinAcentos(r.categoria ?? "").trim();
  const proveedor = palabrasDe(r.proveedor);
  if (!categoria || proveedor.length === 0) return false;
  const etiqueta = sinAcentos(c.etiqueta);
  return etiqueta.startsWith(categoria) && sonParecidas(proveedor, palabrasDe(etiqueta.slice(categoria.length)));
}

/**
 * Los pagos recurrentes que cuentan como costo del mes: lo registrado a mano
 * (la luz bimestral cuesta la mitad por mes) más lo que se detectó del historial
 * y sigue pagándose. No se suma dos veces lo registrado (ni lo pausado a
 * propósito) aunque el historial lo detecte con otro nombre o monto, y la
 * nómina/comisiones/músicos detectados se dejan fuera porque el equipo y los
 * directos ya los cubren.
 */
export function costosRecurrentes(i: { registrados: RegistradoCosto[]; combinados: CombinadoCosto[]; hoy: string }): RecurrenteCosto[] {
  const registrados = i.registrados
    .filter((r) => r.activo)
    .map((r): RecurrenteCosto => ({ concepto: r.nombre, mensual: numero(r.montoEstimado) / cadaMesesSano(r.cadaMeses) }));

  const limite = new Date(Date.parse(`${i.hoy}T00:00:00Z`) - VIVO_DIAS * MS_DIA).toISOString().slice(0, 10);
  const detectados = i.combinados
    .filter((c) => c.origen !== "explicito" && c.ultimaFecha >= limite)
    .filter((c) => !CATEGORIAS_APARTE.some((cat) => sinAcentos(c.etiqueta).startsWith(cat)))
    .filter((c) => !i.registrados.some((r) => esDeRegistrado(c, r)))
    .map((c): RecurrenteCosto => ({ concepto: c.etiqueta, mensual: numero(c.montoEstimado) }));

  return [...registrados, ...detectados].filter((r) => r.mensual > 0);
}

export interface PersonaCosto { nombre: string; rol: string; pagoBase: number; periodicidad: string | null; activo: boolean }
export interface Partida {
  concepto: string;
  mensual: number;
  /** Los sueldos de los socios son lo único que se puede dejar fuera de "lo que cuesta operar". */
  esSocio: boolean;
}

/**
 * Todo lo que cuesta mantener abierto, de lo más caro a lo más barato. Los
 * socios van juntos en una partida con el sueldo del escalón vigente (no el
 * `pago_base` viejo de la tabla del equipo); cada colaborador activo con pago,
 * por separado; y los recurrentes. Dos partidas con el mismo nombre se
 * distinguen con un número para que ninguna lista las fusione.
 */
export function armarPartidas(i: { equipo: PersonaCosto[]; recurrentes: RecurrenteCosto[]; sueldoSocioSemanal: number }): Partida[] {
  const socios = i.equipo.filter((p) => p.activo && p.rol === "socio").length;
  const sueldos: Partida[] = socios > 0 && i.sueldoSocioSemanal > 0
    ? [{ concepto: "Sueldo de socios", mensual: i.sueldoSocioSemanal * socios * SEMANAS_POR_MES, esSocio: true }]
    : [];
  const colaboradores = i.equipo
    .filter((p) => p.activo && p.rol !== "socio")
    .map((p): Partida => ({ concepto: p.nombre, mensual: mensualDe(p.pagoBase, p.periodicidad), esSocio: false }))
    .filter((p) => p.mensual > 0);
  const fijos = i.recurrentes.map((r): Partida => ({ concepto: r.concepto, mensual: r.mensual, esSocio: false }));

  const vistos = new Map<string, number>();
  return [...sueldos, ...colaboradores, ...fijos]
    .sort((a, b) => b.mensual - a.mensual)
    .map((p) => {
      const veces = (vistos.get(p.concepto) ?? 0) + 1;
      vistos.set(p.concepto, veces);
      return veces === 1 ? p : { ...p, concepto: `${p.concepto} (${veces})` };
    });
}

// ─── Lo que queda de cada peso cobrado ───────────────────────────────────────

/**
 * Qué parte de lo cobrado se va en músicos y comisiones (fracción 0-0.9), mirando
 * los últimos `cuantos` meses con cobros anteriores al mes en curso. Con tan
 * pocos datos como los de este estudio, un mes suelto engaña; varios, no.
 */
export function porcentajeDirectos(meses: MesFinanzas[], mesActual: string, cuantos = MESES_A_MOSTRAR, respaldo = DIRECTOS_RESPALDO): number {
  const previos = meses
    .filter((m) => m.mes < mesActual && m.cobrado > 0)
    .sort((a, b) => b.mes.localeCompare(a.mes))
    .slice(0, cuantos);
  const cobrado = previos.reduce((a, m) => a + m.cobrado, 0);
  if (cobrado <= 0) return respaldo;
  const directos = previos.reduce((a, m) => a + m.directos, 0);
  return Math.min(DIRECTOS_MAX, Math.max(0, directos / cobrado));
}

/** De cada peso cobrado, cuánto queda para pagar la operación (fracción 0-1), ya sin músicos ni impuestos. */
export const margenDeContribucion = (directosPct: number, impuestosPct: number): number =>
  Math.max(0, 1 - directosPct - impuestosPct / 100);

/** Cuántos días de operación paga una venta de `monto`. */
export const diasQuePaga = (monto: number, margen: number, costoDia: number): number =>
  costoDia > 0 ? (monto * margen) / costoDia : 0;

/** Cuántos días se aguanta con el colchón si dejara de entrar dinero. Sin colchón o sin costo no hay cifra. */
export const diasDeAire = (colchon: number | null, costoDia: number): number | null =>
  colchon === null || !(costoDia > 0) ? null : Math.max(0, colchon) / costoDia;

// ─── El resumen que pinta el Dashboard ──────────────────────────────────────

/** Un mes de las bolsas con lo cobrado en cada día (índice 0 = día 1): de ahí sale el día real en que se cubre la cuenta. */
export interface MesConDias extends MesFinanzas { cobradoPorDia: number[] }

export interface DatosOperacion {
  meses: MesConDias[];
  partidas: Partida[];
  impuestosPct: number;
  /** Saldo del colchón hoy; null si todavía no se lleva (antes de `inicio` en Finanzas). */
  colchonSaldo: number | null;
}

/**
 * Cómo va el mes en curso cuando todavía no cubre la cuenta:
 * - "pronto": van muy pocos días para proyectar nada;
 * - "llega": al ritmo de los días que van la cubre antes de que acabe el mes;
 * - "no-llega": al ritmo de hoy no alcanza.
 */
export type Ritmo = "pronto" | "llega" | "no-llega";

export interface FilaMes {
  mes: string;
  enCurso: boolean;
  /** Días del mes que ya pasaron (todos, si el mes está cerrado). */
  transcurridos: number;
  cobrado: number;
  /** Lo cobrado menos músicos e impuestos: lo que de verdad queda para operar. */
  neto: number;
  /** Lo que cuesta operar un mes (con el costo de hoy). */
  costo: number;
  holgura: number;
  /** Días de operación que sobraron (o faltaron, en negativo). */
  diasDeHolgura: number;
  cubre: boolean;
  /** Día REAL del mes en que lo neto acumulado alcanzó la cuenta; null si todavía no la cubre. */
  diaEquilibrio: number | null;
  /** Solo el mes en curso sin cubrir. */
  ritmo: Ritmo | null;
  /** Solo con ritmo "llega": el día en que la cubriría si sigue igual. Es una proyección, no un hecho. */
  diaProyectado: number | null;
  /** Gasto de operación que sí se capturó ese mes (con sueldos de socios si se cuentan). */
  registrado: number;
  /** registrado ÷ costo esperado; null si no hay costos configurados. */
  captura: number | null;
}

export interface ResumenOperacion {
  sinCostos: boolean;
  incluirSocios: boolean;
  partidas: Partida[];
  costoMensual: number;
  costoDia: number;
  costoDiaOperar: number;
  costoDiaConSocios: number;
  directosPct: number;
  impuestosPct: number;
  margen: number;
  /** Lo que hay que vender (bruto) en un día para pagarlo; null si no hay cifra. */
  ventaPorDia: number | null;
  filas: FilaMes[];
  actual: FilaMes;
  /** Cuánto se va por delante (o atrás) de lo que ha costado operar en lo que va del mes. */
  adelanto: number | null;
  diasDeAire: number | null;
}

const mesVacio = (mes: string): MesConDias => ({
  mes, cobrado: 0, directos: 0, operacion: 0, sueldosSocios: 0,
  cobradoPorDia: Array.from({ length: diasEnMes(mes) }, () => 0),
});

/** Primer día en que lo cobrado acumulado (ya neto de músicos e impuestos) alcanza el costo del mes. */
function primerDiaCubierto(cobradoPorDia: number[], margen: number, costo: number): number | null {
  let acumulado = 0;
  for (const [i, cobrado] of cobradoPorDia.entries()) {
    acumulado += cobrado * margen;
    if (acumulado >= costo - EPSILON) return i + 1;
  }
  return null;
}

/** Día en que se cubriría el costo si lo neto de `transcurridos` días sigue entrando al mismo ritmo. */
const diaAlRitmo = (costo: number, neto: number, transcurridos: number): number =>
  neto > 0 ? Math.max(1, Math.ceil(costo / (neto / transcurridos) - EPSILON)) : Infinity;

/**
 * Compara lo que cuesta operar contra lo que entra, mes por mes. `hoy` es
 * "YYYY-MM-DD" (en hora de México: el servidor corre en UTC).
 */
export function resumirOperacion(datos: DatosOperacion, hoy: string, incluirSocios: boolean): ResumenOperacion {
  const mesActual = hoy.slice(0, 7);
  const diaHoy = Number(hoy.slice(8, 10)) || 1;
  const suma = (ps: Partida[]) => ps.reduce((a, p) => a + p.mensual, 0);

  const mensualConSocios = suma(datos.partidas);
  const mensualOperar = suma(datos.partidas.filter((p) => !p.esSocio));
  const costoMensual = incluirSocios ? mensualConSocios : mensualOperar;
  const costoDia = costoMensual / DIAS_POR_MES;

  const directosPct = porcentajeDirectos(datos.meses, mesActual);
  const margen = margenDeContribucion(directosPct, datos.impuestosPct);

  // Los últimos meses de calendario, sin saltarse ninguno: un mes sin un solo cobro es el peor caso y no debe desaparecer.
  // No se inventan meses anteriores al primer cobro.
  const porMes = new Map<string, MesConDias>(datos.meses.filter((m) => m.mes <= mesActual).map((m): [string, MesConDias] => [m.mes, m]));
  const primero = [...porMes.keys()].sort()[0] ?? mesActual;
  const limite = mesMas(mesActual, -(MESES_A_MOSTRAR - 1));
  const lista: MesConDias[] = [];
  for (let m = primero > limite ? primero : limite; m <= mesActual; m = mesMas(m, 1)) lista.push(porMes.get(m) ?? mesVacio(m));

  const filas = lista.map((m): FilaMes => {
    const enCurso = m.mes === mesActual;
    const dias = diasEnMes(m.mes);
    const transcurridos = enCurso ? Math.min(diaHoy, dias) : dias;
    const neto = m.cobrado * margen;
    const holgura = neto - costoMensual;
    const cubre = costoMensual > 0 && neto >= costoMensual - EPSILON;

    let diaEquilibrio: number | null = null;
    let ritmo: Ritmo | null = null;
    let diaProyectado: number | null = null;
    if (cubre) {
      // Sin el detalle por día (datos viejos) se cae a repartir lo cobrado parejo.
      diaEquilibrio = primerDiaCubierto(m.cobradoPorDia, margen, costoMensual) ?? diaAlRitmo(costoMensual, neto, transcurridos);
    } else if (enCurso && costoMensual > 0) {
      if (transcurridos < MIN_DIAS_PROYECCION) {
        ritmo = "pronto";
      } else {
        const dia = diaAlRitmo(costoMensual, neto, transcurridos);
        ritmo = dia <= dias ? "llega" : "no-llega";
        diaProyectado = dia <= dias ? dia : null;
      }
    }

    const registrado = m.operacion + (incluirSocios ? m.sueldosSocios : 0);
    return {
      mes: m.mes, enCurso, transcurridos, cobrado: m.cobrado, neto, costo: costoMensual, holgura,
      diasDeHolgura: costoDia > 0 ? holgura / costoDia : 0,
      cubre, diaEquilibrio, ritmo, diaProyectado, registrado,
      captura: costoMensual > 0 ? registrado / costoMensual : null,
    };
  });

  const actual = filas[filas.length - 1];
  const avance = actual.transcurridos / diasEnMes(mesActual);

  return {
    sinCostos: mensualConSocios <= 0,
    incluirSocios,
    partidas: datos.partidas,
    costoMensual,
    costoDia,
    costoDiaOperar: mensualOperar / DIAS_POR_MES,
    costoDiaConSocios: mensualConSocios / DIAS_POR_MES,
    directosPct,
    impuestosPct: datos.impuestosPct,
    margen,
    ventaPorDia: margen > 0 && costoDia > 0 ? costoDia / margen : null,
    filas,
    actual,
    adelanto: costoMensual > 0 ? actual.neto - costoMensual * avance : null,
    diasDeAire: diasDeAire(datos.colchonSaldo, costoDia),
  };
}

// ─── De movimientos sueltos a meses ─────────────────────────────────────────

export interface MovimientosMes {
  ventas: { fecha: string | null; total: number; costoExtra: number; tienePagos: boolean }[];
  pagos: { fecha: string | null; monto: number }[];
  otrosIngresos: { fecha: string | null; monto: number }[];
  egresos: { fecha: string | null; total: number; esCapex: boolean; categoria: string | null }[];
  nomina: { fecha: string | null; monto: number; esSocio: boolean }[];
}

/** Lo que `getDashboardData` ya leyó y el servidor necesita para armar `DatosOperacion` sin volver a consultar. */
export interface FuenteOperacion {
  movimientos: MovimientosMes;
  /** Egresos con proveedor y descripción: de ahí se detectan los pagos recurrentes. */
  egresos: EgresoLite[];
  equipo: PersonaCosto[];
  ajustes: AjustesBolsas;
}

/**
 * Junta los movimientos en los meses que usan las bolsas (`MesFinanzas`), con
 * las mismas reglas que Finanzas: lo cobrado entra por pago (o por el total de
 * la venta si no tiene pagos); músicos y comisiones son directos; el capex no
 * cuenta; los sueldos de socios van aparte del resto de la operación. Además
 * guarda lo cobrado cada día para saber el día real en que se cubre la cuenta.
 */
export function agruparMeses(m: MovimientosMes): MesConDias[] {
  const meses = new Map<string, MesConDias>();
  const de = (fecha: string): MesConDias => {
    const mes = fecha.slice(0, 7);
    const actual = meses.get(mes) ?? mesVacio(mes);
    meses.set(mes, actual);
    return actual;
  };
  const cobra = (fecha: string, monto: number) => {
    const mes = de(fecha);
    const cobrado = numero(monto);
    mes.cobrado += cobrado;
    const dia = Number(fecha.slice(8, 10));
    if (dia >= 1 && dia <= mes.cobradoPorDia.length) mes.cobradoPorDia[dia - 1] += cobrado;
  };

  for (const v of m.ventas) {
    if (!v.fecha) continue;
    de(v.fecha).directos += numero(v.costoExtra);
    if (!v.tienePagos) cobra(v.fecha, v.total);
  }
  for (const p of m.pagos) if (p.fecha) cobra(p.fecha, p.monto);
  for (const i of m.otrosIngresos) if (i.fecha) cobra(i.fecha, i.monto);
  for (const e of m.egresos) {
    if (!e.fecha || e.esCapex) continue;
    const mes = de(e.fecha);
    if ((e.categoria ?? "").startsWith("Comisión")) mes.directos += numero(e.total);
    else mes.operacion += numero(e.total);
  }
  for (const n of m.nomina) {
    if (!n.fecha) continue;
    const mes = de(n.fecha);
    if (n.esSocio) mes.sueldosSocios += numero(n.monto);
    else mes.operacion += numero(n.monto);
  }
  return [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

type Fila = Record<string, unknown>;

/**
 * De las filas crudas de la base a lo que necesita la pestaña. Un pago
 * cancelado de nómina no cuenta; el mes de un pago de nómina es el del periodo
 * pagado (igual que Finanzas); y los socios se reconocen por su rol en `equipo`.
 */
export function armarFuente(i: { ventas: Fila[]; pagos: Fila[]; ingresos: Fila[]; egresos: Fila[]; nomina: Fila[]; equipo: Fila[]; ajustes: AjustesBolsas }): FuenteOperacion {
  const ventasConPagos = new Set(i.pagos.map((p) => texto(p.venta_id)).filter((id): id is string => id !== null));
  const socioIds = new Set(i.equipo.filter((e) => e.rol === "socio").map((e) => texto(e.id)));

  const movimientos: MovimientosMes = {
    ventas: i.ventas.map((v) => ({
      fecha: texto(v.fecha), total: numero(v.total_mxn), costoExtra: numero(v.costo_extra),
      tienePagos: ventasConPagos.has(texto(v.id) ?? ""),
    })),
    pagos: i.pagos.map((p) => ({ fecha: texto(p.fecha), monto: numero(p.monto_mxn) })),
    otrosIngresos: i.ingresos.map((x) => ({ fecha: texto(x.fecha), monto: numero(x.monto_mxn) })),
    egresos: i.egresos.map((e) => ({ fecha: texto(e.fecha), total: numero(e.total_mxn), esCapex: Boolean(e.es_capex), categoria: texto(e.categoria) })),
    nomina: i.nomina
      .filter((n) => n.estado !== "cancelado")
      .map((n) => ({ fecha: texto(n.periodo_inicio), monto: numero(n.monto), esSocio: socioIds.has(texto(n.persona_id)) })),
  };

  const egresos: EgresoLite[] = [];
  for (const e of i.egresos) {
    const fecha = texto(e.fecha);
    if (!fecha) continue;
    egresos.push({
      fecha, categoria: texto(e.categoria), proveedor: texto(e.proveedor), descripcion: texto(e.descripcion),
      total_mxn: numero(e.total_mxn), es_capex: Boolean(e.es_capex),
    });
  }

  const equipo = i.equipo.map((e): PersonaCosto => ({
    nombre: String(e.nombre ?? ""), rol: String(e.rol ?? ""), pagoBase: numero(e.pago_base),
    periodicidad: texto(e.periodicidad), activo: Boolean(e.activo),
  }));

  return { movimientos, egresos, equipo, ajustes: i.ajustes };
}
