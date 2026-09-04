import { supabaseAdmin } from "@/lib/supabase/admin";
import { extraerShortcode } from "@/lib/shortcode";
import { esProyectoDeCliente } from "@/lib/pedido-sync";
import { ESTADOS_NO_ABIERTOS, calcEntregas, type DashProyecto, type EntregasResumen } from "@/lib/entregas";

export type { DashProyecto };

// ─── CRM: contactos ──────────────────────────────────────────────────────────
export interface Contacto {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  etapa: string;
  origen: string | null;
  servicio_interes: string | null;
  motivo_perdida: string | null;
  ltv: number;
  created_at: string;
  /** Nombres de fichas duplicadas que se fusionaron en esta (para validar el dedup) */
  mergedFrom: string[];
  /** Número de ventas asociadas */
  ventasCount: number;
  /** Fecha de la última compra (para recencia / reactivación) */
  ultimaCompra: string | null;
  /** Qué compró esa última vez ("LUNA DE MIEL", "EP") — para el mensaje de recompra. */
  ultimaCompraConcepto: string | null;
  /**
   * Tipo de esa última venta ("Licencia básica", "Beat personalizado"). El
   * concepto suele ser el nombre del beat, así que el TIPO es lo único que dice
   * en qué escalón va el cliente y qué toca ofrecerle después.
   */
  ultimaCompraTipo: string | null;
  /** Proyectos suyos que siguen abiertos (ni entregados, ni cerrados, ni cancelados). */
  proyectosAbiertos: number;
  /** Qué toca hacer con este contacto ("llamar", "mandar cotización"). */
  proximaAccion: string | null;
  /** Cuándo toca (YYYY-MM-DD). Vencida = ya pasó y sigue abierta. */
  proximaFecha: string | null;
}

export const ETAPAS = ["lead", "negociacion", "cliente", "recurrente", "perdido", "inactivo"] as const;

export const ETAPA_LABEL: Record<string, string> = {
  lead: "Lead",
  negociacion: "Negociación",
  cliente: "Cliente",
  recurrente: "Recurrente",
  perdido: "Perdido",
  inactivo: "Inactivo",
};

export async function getContactos(): Promise<Contacto[]> {
  const sb = supabaseAdmin();
  const [activosRes, fusionadosRes, ventasRes, proyRes] = await Promise.all([
    sb.from("contactos")
      .select("id, nombre, telefono, email, direccion, etapa, origen, servicio_interes, motivo_perdida, ltv, created_at, proxima_accion, proxima_fecha")
      .is("merged_into", null)
      .order("ltv", { ascending: false })
      .limit(2000),
    sb.from("contactos").select("nombre, merged_into").not("merged_into", "is", null),
    sb.from("ventas").select("contacto_id, fecha, beat_nombre, tipo").not("contacto_id", "is", null),
    sb.from("proyectos").select("contacto_id, estado").not("contacto_id", "is", null),
  ]);

  // Nombres consolidados por ficha sobreviviente
  const mergedBy = new Map<string, string[]>();
  for (const f of fusionadosRes.data ?? []) {
    const t = f.merged_into as string;
    if (!t) continue;
    const arr = mergedBy.get(t) ?? [];
    if (f.nombre) arr.push(f.nombre as string);
    mergedBy.set(t, arr);
  }
  // Conteo de ventas y última compra por contacto
  const ventasBy = new Map<string, number>();
  const ultimaBy = new Map<string, string>();
  const conceptoBy = new Map<string, string | null>();
  const tipoBy = new Map<string, string | null>();
  for (const v of ventasRes.data ?? []) {
    const id = v.contacto_id as string;
    ventasBy.set(id, (ventasBy.get(id) ?? 0) + 1);
    const f = v.fecha as string | null;
    if (f && (!ultimaBy.has(id) || f > ultimaBy.get(id)!)) {
      ultimaBy.set(id, f);
      conceptoBy.set(id, (v.beat_nombre as string | null) || (v.tipo as string | null) || null);
      tipoBy.set(id, (v.tipo as string | null) ?? null);
    }
  }
  // Trabajo que todavía les debemos: bloquea la oferta de recompra.
  const abiertosBy = new Map<string, number>();
  for (const p of proyRes.data ?? []) {
    if (ESTADOS_NO_ABIERTOS.includes(p.estado as string)) continue;
    const id = p.contacto_id as string;
    abiertosBy.set(id, (abiertosBy.get(id) ?? 0) + 1);
  }

  return (activosRes.data ?? []).map((c) => ({
    ...c,
    ltv: Number(c.ltv) || 0,
    mergedFrom: mergedBy.get(c.id as string) ?? [],
    ventasCount: ventasBy.get(c.id as string) ?? 0,
    ultimaCompra: ultimaBy.get(c.id as string) ?? null,
    ultimaCompraConcepto: conceptoBy.get(c.id as string) ?? null,
    ultimaCompraTipo: tipoBy.get(c.id as string) ?? null,
    proyectosAbiertos: abiertosBy.get(c.id as string) ?? 0,
    proximaAccion: (c.proxima_accion as string | null) ?? null,
    proximaFecha: (c.proxima_fecha as string | null) ?? null,
  })) as Contacto[];
}

/**
 * Ciclos de recompra ya resueltos (programados u omitidos). Se guardan como
 * `interacciones.external_id = recompra:<contacto>:<fecha última compra>`, así
 * que basta un `like` para saber a quién ya no hay que volver a proponer.
 */
export async function getRecompraMarcas(): Promise<Set<string>> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("interacciones")
    .select("external_id")
    .like("external_id", "recompra:%")
    .limit(5000);
  return new Set((data ?? []).map((r) => r.external_id as string));
}

// ─── Ventas ──────────────────────────────────────────────────────────────────
export interface Venta {
  id: string;
  folio: string | null;
  fecha: string;
  cliente: string | null;
  tipo: string | null;
  beat_nombre: string | null;
  canal: string | null;
  moneda: string;
  total_mxn: number;
  /** Comisión de plataforma asociada (egreso BSC-…) si la hay. */
  comision: number;
  /** total_mxn − comisión: lo que de verdad entra. */
  neto: number;
  /** Suma de pagos recibidos (base efectivo). Sin pagos = cobrada al 100%. */
  cobrado: number;
  /** total_mxn − cobrado: lo que falta por cobrar. */
  saldo: number;
  /** liquidada · parcial (anticipo) · pendiente (registrada sin pago) */
  estadoPago: "liquidada" | "parcial" | "pendiente";
  /** costo de músicos de sesión (COGS de la venta) — editable */
  costo_extra: number;
  /** instrumentos/músicos de la venta ("TOLOLOCHE, CHARCHETAS") — para sugerir músicos */
  extras: string | null;
  medio_pago: string | null;
  quien_cerro: string | null;
}

export async function getVentas(): Promise<Venta[]> {
  const sb = supabaseAdmin();
  // ventas/pagos piden comision_stripe_mxn con reintento sin la columna — ver
  // el mismo patrón en getFinanzasERP (si el SQL no ha corrido, no se pierden
  // ventas/pagos enteros por pedir una columna que aún no existe).
  const ventasQuery = (async () => {
    const withComision = await sb
      .from("ventas")
      .select("id, folio, fecha, tipo, beat_nombre, canal, moneda, total_mxn, costo_extra, extras, medio_pago, quien_cerro, comision_stripe_mxn, contactos(nombre)")
      .order("fecha", { ascending: false })
      .limit(1000);
    if (!withComision.error) return withComision;
    return sb
      .from("ventas")
      .select("id, folio, fecha, tipo, beat_nombre, canal, moneda, total_mxn, costo_extra, extras, medio_pago, quien_cerro, contactos(nombre)")
      .order("fecha", { ascending: false })
      .limit(1000);
  })();
  const pagosQuery = (async () => {
    const withComision = await sb.from("pagos").select("venta_id, monto_mxn, comision_stripe_mxn");
    if (!withComision.error) return withComision;
    return sb.from("pagos").select("venta_id, monto_mxn");
  })();
  const [ventasRes, comisionesRes, pagosRes] = await Promise.all([
    ventasQuery,
    // Comisiones (egresos BSC-{idKey}) → para mostrar el neto junto al bruto.
    sb.from("egresos").select("folio, total_mxn").like("folio", "BSC-%"),
    // Pagos (anticipos/finiquitos). Si la tabla aún no existe, .data es null → [].
    pagosQuery,
  ]);

  const comisionPorClave = new Map<string, number>();
  for (const e of comisionesRes.data ?? []) {
    const folio = e.folio as string | null;
    if (folio) comisionPorClave.set(folio.slice(4), Number(e.total_mxn) || 0); // quita "BSC-"
  }

  // Cobrado por venta. Solo las ventas con pagos usan el modelo de anticipos;
  // las que no tienen pagos se asumen cobradas al 100% (instantáneo / histórico).
  // De paso suma la comisión real de Stripe de sus tramos (cotización pagada
  // por partes) — el checkout directo trae la suya propia en `ventas`.
  const cobradoPorVenta = new Map<string, number>();
  const comisionStripePorVenta = new Map<string, number>();
  const tienePagos = new Set<string>();
  for (const p of pagosRes.data ?? []) {
    const id = p.venta_id as string;
    tienePagos.add(id);
    cobradoPorVenta.set(id, (cobradoPorVenta.get(id) ?? 0) + (Number(p.monto_mxn) || 0));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comisionTramo = Number((p as any).comision_stripe_mxn) || 0;
    if (comisionTramo > 0) comisionStripePorVenta.set(id, (comisionStripePorVenta.get(id) ?? 0) + comisionTramo);
  }

  return (ventasRes.data ?? []).map((v) => {
    const id = v.id as string;
    const folio = v.folio as string | null;
    const total = Number(v.total_mxn) || 0;
    const comisionBeatstars = folio && folio.startsWith("BS-") ? comisionPorClave.get(folio.slice(3)) ?? 0 : 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comisionStripe = Number((v as any).comision_stripe_mxn) || comisionStripePorVenta.get(id) || 0;
    const comision = comisionBeatstars + comisionStripe;
    const tiene = tienePagos.has(id);
    const cobrado = tiene ? cobradoPorVenta.get(id) ?? 0 : total;
    const saldo = Math.max(0, total - cobrado);
    const estadoPago: Venta["estadoPago"] =
      saldo <= 0.5 ? "liquidada" : cobrado > 0.5 ? "parcial" : "pendiente";
    return {
      id,
      folio,
      fecha: v.fecha as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cliente: ((v.contactos as any)?.nombre ?? null) as string | null,
      tipo: v.tipo as string | null,
      beat_nombre: v.beat_nombre as string | null,
      canal: v.canal as string | null,
      moneda: (v.moneda as string) || "MXN",
      total_mxn: total,
      comision,
      neto: total - comision,
      cobrado,
      saldo,
      estadoPago,
      costo_extra: Number(v.costo_extra) || 0,
      extras: (v.extras as string | null) ?? null,
      medio_pago: v.medio_pago as string | null,
      quien_cerro: v.quien_cerro as string | null,
    };
  });
}

// ─── Inventario de beats (para el selector y la reconciliación) ──────────────
export interface InventarioBeat {
  id: string;
  folio: string | null;
  nombre: string;
  estado: string;
  catalogo_beat_id: string | null;
}

export async function getInventario(): Promise<InventarioBeat[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("inventario_beats")
    .select("id, folio, nombre, estado, catalogo_beat_id")
    .order("nombre", { ascending: true })
    .limit(2000);
  return (data ?? []) as InventarioBeat[];
}

// ─── Finanzas + Reparto trimestral ───────────────────────────────────────────
export interface QuarterAgg {
  key: string;            // "2026-T1"
  label: string;          // "T1 2026"
  ingresos: number;
  costosDirectos: number; // músicos (costo_extra de ventas)
  gastosOperativos: number; // egresos no-capex
  nomina: number;         // sueldos pagados
}
export interface SocioMin { id: string; nombre: string; participacion_pct: number }
export interface EquipoRow {
  id: string; nombre: string; rol: string; participacion_pct: number;
  pago_base: number; periodicidad: string; pago_variable: boolean; activo: boolean;
}
export interface EgresoRow {
  id: string; fecha: string; categoria: string | null; proveedor: string | null;
  descripcion: string | null; total_mxn: number; es_capex: boolean;
}
export interface NominaRow {
  id: string; persona: string; periodo_inicio: string; monto: number; estado: string; tipo: string;
}
export interface IngresoRow {
  id: string; folio: string | null; fecha: string; fuente: string | null;
  concepto: string | null; moneda: string; monto_mxn: number; recurrente: boolean; nota: string | null;
}
export interface PagoMusicoRow {
  id: string; venta: string | null; beat: string | null; cliente: string | null; proyecto: string | null;
  musico: string | null;
  monto: number; fecha: string | null; medio_pago: string | null; pagado: boolean; nota: string | null;
}

const quarterOf = (fecha: string) => {
  const d = new Date(fecha + "T12:00:00");
  const q = Math.floor(d.getMonth() / 3) + 1;
  return { key: `${d.getFullYear()}-T${q}`, label: `T${q} ${d.getFullYear()}` };
};

export async function getFinanzasERP() {
  const sb = supabaseAdmin();
  const [ventasRes, egresosRes, nominaRes, equipoRes, pagosRes, ingresosRes, pagosMusicoRes] = await Promise.all([
    sb.from("ventas").select("id, fecha, total_mxn, costo_extra"),
    sb.from("egresos").select("id, fecha, categoria, proveedor, descripcion, total_mxn, es_capex").order("fecha", { ascending: false }),
    sb.from("nomina").select("id, periodo_inicio, monto, estado, tipo, equipo(nombre)").order("periodo_inicio", { ascending: false }).limit(100),
    sb.from("equipo").select("id, nombre, rol, participacion_pct, pago_base, periodicidad, pago_variable, activo").order("rol"),
    // Pagos (anticipos/finiquitos). Si la tabla no existe, .data es null → [].
    sb.from("pagos").select("venta_id, fecha, monto_mxn"),
    // Otros ingresos (YouTube, streaming…). Si la tabla no existe, .data es null → [].
    sb.from("ingresos").select("id, folio, fecha, fuente, concepto, moneda, monto_mxn, recurrente, nota").order("fecha", { ascending: false }),
    // Pagos a músicos (COGS itemizado). Trae venta + cliente + proyecto ligado.
    // Si la tabla no existe, .data es null → [].
    sb.from("pagos_musico").select("id, monto, fecha, medio_pago, pagado, nota, musico, ventas(folio, beat_nombre, contactos(nombre), proyectos(titulo))").order("fecha", { ascending: false }),
  ]);

  const quarters = new Map<string, QuarterAgg>();
  const ensureQ = (fecha: string) => {
    const { key, label } = quarterOf(fecha);
    if (!quarters.has(key)) quarters.set(key, { key, label, ingresos: 0, costosDirectos: 0, gastosOperativos: 0, nomina: 0 });
    return quarters.get(key)!;
  };

  // Ventas que tienen pagos registrados → su ingreso se reconoce por pago (base
  // efectivo), no por el total al cierre. Las demás cuentan su total en su fecha.
  const ventasConPagos = new Set<string>();
  for (const p of pagosRes.data ?? []) if (p.venta_id) ventasConPagos.add(p.venta_id as string);

  let ingresosTot = 0, costosTot = 0, gastosTot = 0, nominaTot = 0, capexTot = 0;
  for (const v of ventasRes.data ?? []) {
    if (!v.fecha) continue;
    const q = ensureQ(v.fecha);
    // El costo de músicos (COGS) se imputa siempre en la fecha de la venta.
    q.costosDirectos += Number(v.costo_extra) || 0;
    costosTot += Number(v.costo_extra) || 0;
    // Ingreso: si no tiene pagos, su total cuenta en su fecha (instantáneo/histórico).
    if (!ventasConPagos.has(v.id as string)) {
      q.ingresos += Number(v.total_mxn) || 0;
      ingresosTot += Number(v.total_mxn) || 0;
    }
  }
  // Ingreso de las ventas con anticipos: cada pago en el trimestre de su fecha.
  for (const p of pagosRes.data ?? []) {
    const f = p.fecha as string | null;
    if (!f) continue;
    const monto = Number(p.monto_mxn) || 0;
    ensureQ(f).ingresos += monto;
    ingresosTot += monto;
  }
  // Otros ingresos (YouTube/streaming/payouts): entran igual que las ventas.
  const ingresos: IngresoRow[] = [];
  for (const i of ingresosRes.data ?? []) {
    const row: IngresoRow = {
      id: i.id as string, folio: (i.folio as string | null) ?? null, fecha: i.fecha as string,
      fuente: (i.fuente as string | null) ?? null, concepto: (i.concepto as string | null) ?? null,
      moneda: (i.moneda as string) || "MXN", monto_mxn: Number(i.monto_mxn) || 0,
      recurrente: Boolean(i.recurrente), nota: (i.nota as string | null) ?? null,
    };
    ingresos.push(row);
    if (row.fecha) { ensureQ(row.fecha).ingresos += row.monto_mxn; ingresosTot += row.monto_mxn; }
  }
  const egresos: EgresoRow[] = [];
  for (const e of egresosRes.data ?? []) {
    const row: EgresoRow = {
      id: e.id as string, fecha: e.fecha as string, categoria: e.categoria as string | null,
      proveedor: e.proveedor as string | null, descripcion: e.descripcion as string | null,
      total_mxn: Number(e.total_mxn) || 0, es_capex: Boolean(e.es_capex),
    };
    egresos.push(row);
    if (e.fecha) {
      if (row.es_capex) capexTot += row.total_mxn;
      else { ensureQ(e.fecha).gastosOperativos += row.total_mxn; gastosTot += row.total_mxn; }
    }
  }
  // Comisión de Stripe: ya está sumada arriba como un Egreso normal (mismo
  // trato que BeatStars) — este total es solo informativo, para el pie de
  // página de Finanzas. NO se vuelve a sumar a ningún total.
  const comisionStripeTot = egresos.reduce((a, e) => a + (e.categoria === "Comisión Stripe" ? e.total_mxn : 0), 0);
  const nomina: NominaRow[] = [];
  for (const n of nominaRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persona = ((n.equipo as any)?.nombre ?? "—") as string;
    nomina.push({
      id: n.id as string, persona, periodo_inicio: n.periodo_inicio as string,
      monto: Number(n.monto) || 0, estado: n.estado as string, tipo: n.tipo as string,
    });
    if (n.periodo_inicio) { ensureQ(n.periodo_inicio).nomina += Number(n.monto) || 0; nominaTot += Number(n.monto) || 0; }
  }

  const equipo = (equipoRes.data ?? []).map((e) => ({
    id: e.id as string, nombre: e.nombre as string, rol: e.rol as string,
    participacion_pct: Number(e.participacion_pct) || 0, pago_base: Number(e.pago_base) || 0,
    periodicidad: e.periodicidad as string, pago_variable: Boolean(e.pago_variable), activo: Boolean(e.activo),
  })) as EquipoRow[];

  const socios: SocioMin[] = equipo
    .filter((e) => e.rol === "socio")
    .map((e) => ({ id: e.id, nombre: e.nombre, participacion_pct: e.participacion_pct }));

  // Pagos a músicos (COGS itemizado). Ya vienen sumados en costo_extra de cada
  // venta (por eso NO se restan otra vez aquí); esta lista es solo para verlos.
  const pagosMusico: PagoMusicoRow[] = [];
  let musicoTot = 0, musicoPendiente = 0;
  for (const p of pagosMusicoRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (p.ventas as any) ?? null;
    // proyectos embebido es arreglo (relación inversa por venta_id) → tomamos el 1º.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proy = v ? ((Array.isArray(v.proyectos) ? v.proyectos[0] : v.proyectos) as any) : null;
    const monto = Number(p.monto) || 0;
    const pagado = Boolean(p.pagado);
    pagosMusico.push({
      id: p.id as string,
      venta: v ? ((v.folio as string) || null) : null,
      beat: v ? ((v.beat_nombre as string | null) ?? null) : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cliente: v ? (((v.contactos as any)?.nombre as string | null) ?? null) : null,
      proyecto: (proy?.titulo as string | null) ?? null,
      musico: (p.musico as string | null) ?? null, monto, fecha: (p.fecha as string | null) ?? null,
      medio_pago: (p.medio_pago as string | null) ?? null, pagado, nota: (p.nota as string | null) ?? null,
    });
    musicoTot += monto;
    if (!pagado) musicoPendiente += monto;
  }

  return {
    quarters: [...quarters.values()].sort((a, b) => b.key.localeCompare(a.key)),
    socios,
    equipo,
    egresos,
    ingresos,
    nomina,
    pagosMusico,
    totals: { ingresos: ingresosTot, costosDirectos: costosTot, gastosOperativos: gastosTot, nomina: nominaTot, capex: capexTot, musico: musicoTot, musicoPendiente, comisionStripe: comisionStripeTot },
  };
}

// ─── Dashboard dinámico (datos crudos para filtrar en el cliente) ────────────
export interface DashVenta {
  fecha: string; total_mxn: number; costo_extra: number;
  canal: string | null; tipo: string | null; beat_nombre: string | null; cliente: string | null;
}
/** Evento de ingreso en base efectivo (lo cobrado): 1 por pago, o el total si la
 *  venta no tiene pagos (instantáneo/histórico). Hereda los atributos de su venta. */
export interface DashIngreso {
  fecha: string; monto: number;
  canal: string | null; tipo: string | null; beat_nombre: string | null; cliente: string | null;
}
export interface DashEgreso { fecha: string; total_mxn: number; es_capex: boolean; categoria: string | null }
export interface DashContacto { created_at: string; etapa: string; origen: string | null; ltv: number; nombre: string | null }

export async function getDashboardData(): Promise<{
  ventas: DashVenta[]; ingresos: DashIngreso[]; egresos: DashEgreso[]; contactos: DashContacto[];
  proyectos: DashProyecto[];
}> {
  const sb = supabaseAdmin();
  const [vRes, eRes, cRes, pRes, iRes, nRes, prRes] = await Promise.all([
    sb.from("ventas").select("id, fecha, total_mxn, costo_extra, canal, tipo, beat_nombre, contactos(nombre)").limit(5000),
    sb.from("egresos").select("fecha, total_mxn, es_capex, categoria").limit(5000),
    sb.from("contactos").select("created_at, etapa, origen, ltv, nombre").is("merged_into", null).limit(5000),
    sb.from("pagos").select("venta_id, fecha, monto_mxn").limit(5000),
    sb.from("ingresos").select("fecha, monto_mxn, fuente").limit(5000),
    sb.from("nomina").select("periodo_inicio, fecha_pago, monto, estado").limit(5000),
    sb.from("proyectos").select("id, folio, titulo, clase, tipo, estado, venta_id, created_at, fecha_entrega, fecha_entrega_real").limit(5000),
  ]);

  // Pagos por venta (si la tabla no existe, queda vacío → todo se cobra al 100%).
  const pagosPorVenta = new Map<string, { fecha: string; monto: number }[]>();
  for (const p of pRes.data ?? []) {
    const id = p.venta_id as string;
    if (!id) continue;
    const arr = pagosPorVenta.get(id) ?? [];
    arr.push({ fecha: p.fecha as string, monto: Number(p.monto_mxn) || 0 });
    pagosPorVenta.set(id, arr);
  }

  const ventas: DashVenta[] = [];
  const ingresos: DashIngreso[] = [];
  for (const v of vRes.data ?? []) {
    const canal = v.canal as string | null;
    const tipo = v.tipo as string | null;
    const beat_nombre = v.beat_nombre as string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = ((v.contactos as any)?.nombre ?? null) as string | null;
    const total = Number(v.total_mxn) || 0;
    ventas.push({ fecha: v.fecha as string, total_mxn: total, costo_extra: Number(v.costo_extra) || 0, canal, tipo, beat_nombre, cliente });

    const pagos = pagosPorVenta.get(v.id as string);
    if (pagos && pagos.length) {
      // Base efectivo: cada pago cuenta como ingreso en SU fecha.
      for (const p of pagos) if (p.fecha) ingresos.push({ fecha: p.fecha, monto: p.monto, canal, tipo, beat_nombre, cliente });
    } else if (v.fecha) {
      // Sin pagos = cobrada al 100% en la fecha de la venta (instantáneo/histórico).
      ingresos.push({ fecha: v.fecha as string, monto: total, canal, tipo, beat_nombre, cliente });
    }
  }
  // Otros ingresos (YouTube/streaming/payouts) como ingreso en base efectivo.
  for (const i of iRes.data ?? []) {
    if (!i.fecha) continue;
    ingresos.push({
      fecha: i.fecha as string, monto: Number(i.monto_mxn) || 0,
      canal: (i.fuente as string | null) ?? null, tipo: "Otro ingreso", beat_nombre: null, cliente: null,
    });
  }
  const egresos: DashEgreso[] = (eRes.data ?? []).map((e) => ({
    fecha: e.fecha as string, total_mxn: Number(e.total_mxn) || 0,
    es_capex: Boolean(e.es_capex), categoria: e.categoria as string | null,
  }));
  // Nómina estructurada (tabla `nomina`) = sueldos pagados. Siempre OPEX, nunca CAPEX.
  // Se cuenta como egreso en el Dashboard para que la utilidad no quede inflada.
  for (const n of nRes.data ?? []) {
    if ((n.estado as string | null) === "cancelado") continue;
    const fecha = (n.fecha_pago ?? n.periodo_inicio) as string | null;
    if (!fecha) continue;
    egresos.push({ fecha, total_mxn: Number(n.monto) || 0, es_capex: false, categoria: "Nómina" });
  }
  const contactos: DashContacto[] = (cRes.data ?? []).map((c) => ({
    created_at: c.created_at as string, etapa: c.etapa as string,
    origen: c.origen as string | null, ltv: Number(c.ltv) || 0, nombre: c.nombre as string | null,
  }));

  // Proyectos para medir el tiempo de entrega (venta → entregado). La fecha de la
  // venta ligada es el arranque real del reloj; created_at es el respaldo.
  const fechaDeVenta = new Map<string, string>();
  for (const v of vRes.data ?? []) if (v.id && v.fecha) fechaDeVenta.set(v.id as string, v.fecha as string);

  const proyectos: DashProyecto[] = (prRes.data ?? []).map((p) => ({
    id: p.id as string,
    folio: (p.folio as string | null) ?? null,
    titulo: (p.titulo as string) ?? "",
    tipo: (p.tipo as string | null) ?? null,
    estado: (p.estado as string) ?? "cola",
    esCliente: esProyectoDeCliente({ clase: p.clase as string | null, tipo: p.tipo as string | null }),
    fechaVenta: p.venta_id ? fechaDeVenta.get(p.venta_id as string) ?? null : null,
    creado: ((p.created_at as string | null) ?? "").slice(0, 10),
    fechaEntrega: (p.fecha_entrega as string | null) ?? null,
    fechaEntregaReal: (p.fecha_entrega_real as string | null) ?? null,
  }));

  return { ventas, ingresos, egresos, contactos, proyectos };
}

// ─── Producción / Proyectos ──────────────────────────────────────────────────
export const ESTADOS_PROY = ["cola", "produccion", "revision", "entregado", "cerrado", "pausado", "cancelado"] as const;
export const ESTADO_PROY_LABEL: Record<string, string> = {
  cola: "Cola", produccion: "Producción", revision: "Revisión", entregado: "Entregado",
  cerrado: "Cerrado", pausado: "Pausado", cancelado: "Cancelado",
};
/**
 * Color de cada estado. Vive aquí y no en el tablero porque lo usan varias
 * pantallas (Producción y REAPER) y dos paletas distintas para lo mismo se
 * vuelven ruido: el ámbar tiene que significar "en producción" en todas.
 */
export const ESTADO_PROY_COLOR: Record<string, string> = {
  cola: "bg-white/10 text-white/60",
  produccion: "bg-amber-500/15 text-amber-300",
  revision: "bg-purple-500/15 text-purple-300",
  entregado: "bg-blue-500/15 text-blue-300",
  cerrado: "bg-green-500/15 text-green-300",
  pausado: "bg-white/5 text-white/40",
  cancelado: "bg-white/5 text-white/35",
};

/** El mismo estado como borde/acento, para resaltar una tarjeta completa. */
export const ESTADO_PROY_BORDE: Record<string, string> = {
  cola: "border-l-white/25",
  produccion: "border-l-amber-400",
  revision: "border-l-purple-400",
  entregado: "border-l-blue-400",
  cerrado: "border-l-green-400",
  pausado: "border-l-white/15",
  cancelado: "border-l-white/10",
};

export const TIPO_PROY_LABEL: Record<string, string> = {
  beat_personalizado: "Beat personalizado", bp_letra: "BP + Letra", grabacion: "Grabación",
  mezcla_master: "Mezcla / Master", exclusividad: "Exclusividad",
  beat: "Beat", creacion_contenido: "Creación de contenido",
  ep: "EP", album: "Álbum",
  contenido: "Contenido", distribucion: "Distribución", admin: "Administrativo",
};
export const PRIORIDAD_LABEL: Record<string, string> = { baja: "Baja", media: "Media", alta: "Alta" };

export interface PostMetricas {
  media_id: string; permalink: string | null;
  likes: number; comentarios: number; guardados: number; compartidos: number;
  alcance: number; reproducciones: number; interacciones: number;
}
export interface SubTarea { id: string; titulo: string; hecho: boolean; orden: number; responsable: string | null; responsable_id: string | null }
export interface ProyectoTarea {
  id: string; titulo: string; hecho: boolean;
  responsable: string | null; responsable_id: string | null; orden: number;
  notas: string | null; fecha: string | null;
  link_post: string | null; metricas: PostMetricas | null;
  visible_cliente: boolean;
  /** Ronda de revisión: 0 = producción original; 1+ = tarea de esa ronda de cambios. */
  revision: number;
  subtareas: SubTarea[];
}
export interface Proyecto {
  id: string; folio: string | null; clase: "produccion" | "interna";
  titulo: string; tipo: string | null; estado: string; prioridad: string;
  contacto: string | null; contacto_id: string | null;
  venta_id: string | null; ventaTotal: number; ventaSaldo: number;
  responsable: string | null; responsable_id: string | null;
  responsables: string[]; responsablesNombres: string[];
  fecha_inicio: string | null; fecha_entrega: string | null; fecha_entrega_real: string | null;
  /** Arranque del reloj para medir antigüedad: fecha de la venta ligada, si hay. */
  fechaVenta: string | null;
  /** created_at en YYYY-MM-DD (respaldo cuando el proyecto no tiene venta). */
  creado: string;
  brief: string | null; entregable_url: string | null; notas: string | null;
  tonalidad: string | null; bpm: number | null;
  /** Carpeta de Drive donde el cliente sube sus archivos (null si aún no se crea o Drive no está configurado). */
  drive_folder_id: string | null;
  plataforma: string | null; fecha_publicacion: string | null; link_post: string | null;
  /** Métricas reales del post ligado (por shortcode del link_post), si hay match. */
  metricas: PostMetricas | null;
  /** % de avance ponderado por tareas y subtareas (0–100) */
  progreso: number;
  /** Ronda de revisión en curso (0 = sin revisiones todavía). */
  revisionActual: number;
  tareas: ProyectoTarea[];
}

export async function getEquipoActivo(): Promise<{ id: string; nombre: string; email: string | null; rol: string | null }[]> {
  const sb = supabaseAdmin();
  const { data } = await sb.from("equipo").select("id, nombre, email, rol, activo").order("nombre");
  return (data ?? [])
    .filter((e) => e.activo !== false)
    .map((e) => ({
      id: e.id as string,
      nombre: e.nombre as string,
      email: (e.email as string | null) ?? null,
      rol: (e.rol as string | null) ?? null,
    }));
}

export async function getProyectos(): Promise<Proyecto[]> {
  const sb = supabaseAdmin();
  const [provRes, tareasRes, equipoRes, ventasRes, pagosRes, subtareasRes, postsRes] = await Promise.all([
    sb.from("proyectos").select("*, contactos(nombre)").order("created_at", { ascending: false }).limit(1000),
    sb.from("proyecto_tareas").select("id, proyecto_id, titulo, hecho, responsable_id, notas, fecha, orden, link_post, visible_cliente, revision").order("orden", { ascending: true }),
    sb.from("equipo").select("id, nombre"),
    sb.from("ventas").select("id, total_mxn, fecha"),
    sb.from("pagos").select("venta_id, monto_mxn"),
    sb.from("proyecto_subtareas").select("id, tarea_id, titulo, hecho, responsable_id, orden").order("orden", { ascending: true }),
    sb.from("social_posts").select("media_id, permalink, likes, comentarios, guardados, compartidos, alcance, reproducciones"),
  ]);

  // Mapa shortcode -> métricas reales, para ligar cada pieza de contenido a su post.
  const metricasPorCode = new Map<string, PostMetricas>();
  for (const sp of postsRes.data ?? []) {
    const code = extraerShortcode(sp.permalink as string | null);
    if (!code) continue;
    const likes = Number(sp.likes) || 0, comentarios = Number(sp.comentarios) || 0;
    const guardados = Number(sp.guardados) || 0, compartidos = Number(sp.compartidos) || 0;
    metricasPorCode.set(code, {
      media_id: sp.media_id as string, permalink: (sp.permalink as string | null) ?? null,
      likes, comentarios, guardados, compartidos,
      alcance: Number(sp.alcance) || 0, reproducciones: Number(sp.reproducciones) || 0,
      interacciones: likes + comentarios + guardados + compartidos,
    });
  }

  const equipoMap = new Map<string, string>();
  for (const e of equipoRes.data ?? []) equipoMap.set(e.id as string, e.nombre as string);

  const subtareasPorTarea = new Map<string, SubTarea[]>();
  for (const s of subtareasRes.data ?? []) {
    const tid = s.tarea_id as string;
    const arr = subtareasPorTarea.get(tid) ?? [];
    const srid = (s.responsable_id as string | null) ?? null;
    arr.push({
      id: s.id as string, titulo: s.titulo as string, hecho: Boolean(s.hecho), orden: Number(s.orden) || 0,
      responsable_id: srid, responsable: srid ? equipoMap.get(srid) ?? null : null,
    });
    subtareasPorTarea.set(tid, arr);
  }

  const ventaTotalMap = new Map<string, number>();
  const ventaFechaMap = new Map<string, string>();
  for (const v of ventasRes.data ?? []) {
    ventaTotalMap.set(v.id as string, Number(v.total_mxn) || 0);
    if (v.fecha) ventaFechaMap.set(v.id as string, v.fecha as string);
  }
  const cobradoPorVenta = new Map<string, number>();
  const tienePagos = new Set<string>();
  for (const p of pagosRes.data ?? []) {
    const id = p.venta_id as string;
    if (!id) continue;
    tienePagos.add(id);
    cobradoPorVenta.set(id, (cobradoPorVenta.get(id) ?? 0) + (Number(p.monto_mxn) || 0));
  }

  const tareasPorProyecto = new Map<string, ProyectoTarea[]>();
  for (const t of tareasRes.data ?? []) {
    const pid = t.proyecto_id as string;
    const arr = tareasPorProyecto.get(pid) ?? [];
    const rid = (t.responsable_id as string | null) ?? null;
    arr.push({
      id: t.id as string, titulo: t.titulo as string, hecho: Boolean(t.hecho),
      responsable_id: rid, responsable: rid ? equipoMap.get(rid) ?? null : null, orden: Number(t.orden) || 0,
      notas: (t.notas as string | null) ?? null, fecha: (t.fecha as string | null) ?? null,
      link_post: (t.link_post as string | null) ?? null,
      metricas: metricasPorCode.get(extraerShortcode(t.link_post as string | null) ?? "") ?? null,
      visible_cliente: t.visible_cliente !== false,
      revision: Number(t.revision) || 0,
      subtareas: subtareasPorTarea.get(t.id as string) ?? [],
    });
    tareasPorProyecto.set(pid, arr);
  }

  return (provRes.data ?? []).map((p) => {
    const ventaId = (p.venta_id as string | null) ?? null;
    const total = ventaId ? ventaTotalMap.get(ventaId) ?? 0 : 0;
    const cobrado = ventaId ? (tienePagos.has(ventaId) ? cobradoPorVenta.get(ventaId) ?? 0 : total) : 0;
    const rid = (p.responsable_id as string | null) ?? null;
    const respIds = (((p.responsables as string[] | null) ?? (rid ? [rid] : [])) as string[]).filter(Boolean);
    const respNombres = respIds.map((id) => equipoMap.get(id)).filter((n): n is string => !!n);
    // Avance ponderado: cada tarea vale igual; las que tienen subtareas aportan su fracción.
    const tareas = tareasPorProyecto.get(p.id as string) ?? [];
    let progreso = 0;
    if (tareas.length) {
      const sum = tareas.reduce((a, t) =>
        a + (t.hecho ? 1 : (t.subtareas.length ? t.subtareas.filter((s) => s.hecho).length / t.subtareas.length : 0)), 0);
      progreso = Math.round((sum / tareas.length) * 100);
    }
    return {
      id: p.id as string, folio: p.folio as string | null, clase: (p.clase as "produccion" | "interna") ?? "produccion",
      titulo: p.titulo as string, tipo: p.tipo as string | null, estado: p.estado as string, prioridad: (p.prioridad as string) || "media",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contacto: ((p.contactos as any)?.nombre ?? null) as string | null,
      contacto_id: (p.contacto_id as string | null) ?? null,
      venta_id: ventaId, ventaTotal: total, ventaSaldo: Math.max(0, total - cobrado),
      responsable_id: rid, responsable: rid ? equipoMap.get(rid) ?? null : null,
      responsables: respIds, responsablesNombres: respNombres,
      fecha_inicio: p.fecha_inicio as string | null, fecha_entrega: p.fecha_entrega as string | null,
      fecha_entrega_real: p.fecha_entrega_real as string | null,
      fechaVenta: ventaId ? ventaFechaMap.get(ventaId) ?? null : null,
      creado: ((p.created_at as string | null) ?? "").slice(0, 10),
      brief: p.brief as string | null, entregable_url: p.entregable_url as string | null, notas: p.notas as string | null,
      tonalidad: (p.tonalidad as string | null) ?? null, bpm: p.bpm == null ? null : Number(p.bpm),
      drive_folder_id: (p.drive_folder_id as string | null) ?? null,
      plataforma: (p.plataforma as string | null) ?? null,
      fecha_publicacion: (p.fecha_publicacion as string | null) ?? null,
      link_post: (p.link_post as string | null) ?? null,
      metricas: metricasPorCode.get(extraerShortcode(p.link_post as string | null) ?? "") ?? null,
      tareas, progreso,
      revisionActual: Number(p.revision_actual) || 0,
    } as Proyecto;
  });
}

// ─── Detalle completo de un proyecto (vista 360°) ────────────────────────────
export interface PagoProyecto { id: string; fecha: string; monto_mxn: number; medio_pago: string | null; tipo: string | null }
export interface ContratoResumen { id: string; folio: string | null; estado: string; monto: number; moneda: string | null; created_at: string }
export interface CotizacionResumen { id: string; folio: string | null; estado: string; created_at: string }
export interface RenderJobResumen { id: string; tipo: string; estado: string; tarea_id: string | null; created_at: string; drive_urls: string[] | null }
export interface RenderInventarioItem { id: string; tarea_id: string | null; clave: string; datos: unknown; updated_at: string }
export interface ActividadItem { id: string; tipo: string; titulo: string; actor: string | null; created_at: string }
/** a_tiempo/en_riesgo comparan contra la mediana histórica del mismo tipo (ver getEntregasReferencia). */
export type SaludEntrega = "sin_fecha" | "a_tiempo" | "en_riesgo" | "atrasado" | "entregado";

export interface ProyectoDetalle extends Proyecto {
  contactoEmail: string | null;
  contactoTelefono: string | null;
  pagos: PagoProyecto[];
  contratos: ContratoResumen[];
  cotizacion: CotizacionResumen | null;
  renderJobs: RenderJobResumen[];
  renderInventario: RenderInventarioItem[];
  actividad: ActividadItem[];
  diasParaEntrega: number | null;
  diasDeAtraso: number | null;
  saludEntrega: SaludEntrega;
  entregasReferencia: EntregasResumen | null;
}

/** Cohorte de referencia (mismo tipo) para juzgar si ESTE proyecto va a tiempo — calcEntregas es agregado, aquí se compara 1 contra el resto. */
export async function getEntregasReferencia(tipo: string | null): Promise<EntregasResumen | null> {
  if (!tipo) return null;
  const sb = supabaseAdmin();
  const { data } = await sb.from("proyectos")
    .select("id, folio, titulo, tipo, estado, fecha_entrega, fecha_entrega_real, created_at, venta_id")
    .eq("tipo", tipo)
    .limit(500);
  if (!data || !data.length) return null;
  const ventaIds = [...new Set(data.map((p) => p.venta_id as string | null).filter((x): x is string => !!x))];
  const ventaFechaMap = new Map<string, string>();
  if (ventaIds.length) {
    const { data: vs } = await sb.from("ventas").select("id, fecha").in("id", ventaIds);
    for (const v of vs ?? []) if (v.fecha) ventaFechaMap.set(v.id as string, v.fecha as string);
  }
  const lista: DashProyecto[] = data.map((p) => ({
    id: p.id as string, folio: (p.folio as string | null) ?? null, titulo: p.titulo as string,
    tipo: p.tipo as string | null, estado: p.estado as string, esCliente: true,
    fechaVenta: p.venta_id ? ventaFechaMap.get(p.venta_id as string) ?? null : null,
    creado: ((p.created_at as string | null) ?? "").slice(0, 10),
    fechaEntrega: (p.fecha_entrega as string | null) ?? null,
    fechaEntregaReal: (p.fecha_entrega_real as string | null) ?? null,
  }));
  return calcEntregas(lista);
}

/** Vista 360° de un solo proyecto: todo lo que ya calcula getProyectos() más lo que le falta (contratos, cotización, renders, bitácora). */
export async function getProyectoDetalle(id: string): Promise<ProyectoDetalle | null> {
  const sb = supabaseAdmin();
  const { data: p } = await sb.from("proyectos").select("*, contactos(nombre, email, telefono)").eq("id", id).single();
  if (!p) return null;

  const ventaId = (p.venta_id as string | null) ?? null;
  const cotizacionId = (p.cotizacion_id as string | null) ?? null;

  const [tareasRes, equipoRes, ventaRes, contratosRes, cotizacionRes, renderJobsRes, renderInvRes, actividadRes, postsRes, referencia] = await Promise.all([
    sb.from("proyecto_tareas").select("id, proyecto_id, titulo, hecho, responsable_id, notas, fecha, orden, link_post, visible_cliente, revision").eq("proyecto_id", id).order("orden", { ascending: true }),
    sb.from("equipo").select("id, nombre"),
    ventaId
      ? sb.from("ventas").select("id, total_mxn, fecha, moneda").eq("id", ventaId).single()
      : Promise.resolve({ data: null as { id: string; total_mxn: number; fecha: string | null; moneda: string | null } | null }),
    sb.from("contratos").select("id, folio, estado, monto, moneda, created_at").eq("proyecto_id", id).order("created_at", { ascending: false }),
    cotizacionId
      ? sb.from("cotizaciones").select("id, folio, estado, created_at").eq("id", cotizacionId).single()
      : Promise.resolve({ data: null as { id: string; folio: string | null; estado: string; created_at: string } | null }),
    sb.from("render_jobs").select("id, tipo, estado, tarea_id, created_at, drive_urls").eq("proyecto_id", id).order("created_at", { ascending: false }),
    sb.from("render_inventario").select("id, tarea_id, clave, datos, updated_at").eq("proyecto_id", id),
    sb.from("actividad").select("id, tipo, titulo, actor, created_at").eq("proyecto_id", id).order("created_at", { ascending: false }).limit(100),
    sb.from("social_posts").select("media_id, permalink, likes, comentarios, guardados, compartidos, alcance, reproducciones"),
    getEntregasReferencia(p.tipo as string | null),
  ]);

  const tareaIds = (tareasRes.data ?? []).map((t) => t.id as string);
  const [subtareasRes, pagosRes] = await Promise.all([
    tareaIds.length
      ? sb.from("proyecto_subtareas").select("id, tarea_id, titulo, hecho, responsable_id, orden").in("tarea_id", tareaIds).order("orden", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; tarea_id: string; titulo: string; hecho: boolean; responsable_id: string | null; orden: number }[] }),
    ventaId
      ? sb.from("pagos").select("id, fecha, monto_mxn, medio_pago, tipo").eq("venta_id", ventaId).order("fecha", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; fecha: string; monto_mxn: number; medio_pago: string | null; tipo: string | null }[] }),
  ]);

  const equipoMap = new Map<string, string>();
  for (const e of equipoRes.data ?? []) equipoMap.set(e.id as string, e.nombre as string);

  const metricasPorCode = new Map<string, PostMetricas>();
  for (const sp of postsRes.data ?? []) {
    const code = extraerShortcode(sp.permalink as string | null);
    if (!code) continue;
    const likes = Number(sp.likes) || 0, comentarios = Number(sp.comentarios) || 0;
    const guardados = Number(sp.guardados) || 0, compartidos = Number(sp.compartidos) || 0;
    metricasPorCode.set(code, {
      media_id: sp.media_id as string, permalink: (sp.permalink as string | null) ?? null,
      likes, comentarios, guardados, compartidos,
      alcance: Number(sp.alcance) || 0, reproducciones: Number(sp.reproducciones) || 0,
      interacciones: likes + comentarios + guardados + compartidos,
    });
  }

  const subtareasPorTarea = new Map<string, SubTarea[]>();
  for (const s of subtareasRes.data ?? []) {
    const tid = s.tarea_id as string;
    const arr = subtareasPorTarea.get(tid) ?? [];
    const srid = (s.responsable_id as string | null) ?? null;
    arr.push({
      id: s.id as string, titulo: s.titulo as string, hecho: Boolean(s.hecho), orden: Number(s.orden) || 0,
      responsable_id: srid, responsable: srid ? equipoMap.get(srid) ?? null : null,
    });
    subtareasPorTarea.set(tid, arr);
  }

  const tareas: ProyectoTarea[] = (tareasRes.data ?? []).map((t) => {
    const rid = (t.responsable_id as string | null) ?? null;
    return {
      id: t.id as string, titulo: t.titulo as string, hecho: Boolean(t.hecho),
      responsable_id: rid, responsable: rid ? equipoMap.get(rid) ?? null : null, orden: Number(t.orden) || 0,
      notas: (t.notas as string | null) ?? null, fecha: (t.fecha as string | null) ?? null,
      link_post: (t.link_post as string | null) ?? null,
      metricas: metricasPorCode.get(extraerShortcode(t.link_post as string | null) ?? "") ?? null,
      visible_cliente: t.visible_cliente !== false,
      revision: Number(t.revision) || 0,
      subtareas: subtareasPorTarea.get(t.id as string) ?? [],
    };
  });

  let progreso = 0;
  if (tareas.length) {
    const sum = tareas.reduce((a, t) =>
      a + (t.hecho ? 1 : (t.subtareas.length ? t.subtareas.filter((s) => s.hecho).length / t.subtareas.length : 0)), 0);
    progreso = Math.round((sum / tareas.length) * 100);
  }

  const venta = ventaRes.data;
  const ventaTotal = venta ? Number(venta.total_mxn) || 0 : 0;
  const pagos: PagoProyecto[] = (pagosRes.data ?? []).map((pg) => ({
    id: pg.id as string, fecha: pg.fecha as string, monto_mxn: Number(pg.monto_mxn) || 0,
    medio_pago: (pg.medio_pago as string | null) ?? null, tipo: (pg.tipo as string | null) ?? null,
  }));
  const cobrado = pagos.length ? pagos.reduce((a, pg) => a + pg.monto_mxn, 0) : ventaTotal;
  const ventaSaldo = Math.max(0, ventaTotal - cobrado);

  const rid = (p.responsable_id as string | null) ?? null;
  const respIds = (((p.responsables as string[] | null) ?? (rid ? [rid] : [])) as string[]).filter(Boolean);
  const respNombres = respIds.map((r) => equipoMap.get(r)).filter((n): n is string => !!n);

  const hoyStr = new Date().toISOString().slice(0, 10);
  const fechaEntrega = (p.fecha_entrega as string | null) ?? null;
  const entregado = ["entregado", "cerrado"].includes(p.estado as string);
  let diasParaEntrega: number | null = null;
  let diasDeAtraso: number | null = null;
  let saludEntrega: SaludEntrega = "sin_fecha";
  if (entregado) {
    saludEntrega = "entregado";
  } else if (fechaEntrega) {
    const diff = Math.round((new Date(fechaEntrega + "T12:00:00").getTime() - new Date(hoyStr + "T12:00:00").getTime()) / 86400000);
    if (diff < 0) {
      diasDeAtraso = -diff;
      saludEntrega = "atrasado";
    } else {
      diasParaEntrega = diff;
      const umbral = referencia?.mediana != null ? Math.max(2, Math.round(referencia.mediana * 0.25)) : 3;
      saludEntrega = diff <= umbral ? "en_riesgo" : "a_tiempo";
    }
  }

  const contactoRaw = p.contactos as { nombre: string | null; email: string | null; telefono: string | null } | null;

  return {
    id: p.id as string, folio: p.folio as string | null, clase: (p.clase as "produccion" | "interna") ?? "produccion",
    titulo: p.titulo as string, tipo: p.tipo as string | null, estado: p.estado as string, prioridad: (p.prioridad as string) || "media",
    contacto: contactoRaw?.nombre ?? null, contacto_id: (p.contacto_id as string | null) ?? null,
    venta_id: ventaId, ventaTotal, ventaSaldo,
    responsable_id: rid, responsable: rid ? equipoMap.get(rid) ?? null : null,
    responsables: respIds, responsablesNombres: respNombres,
    fecha_inicio: p.fecha_inicio as string | null, fecha_entrega: fechaEntrega,
    fecha_entrega_real: p.fecha_entrega_real as string | null,
    fechaVenta: venta?.fecha ?? null,
    creado: ((p.created_at as string | null) ?? "").slice(0, 10),
    brief: p.brief as string | null, entregable_url: p.entregable_url as string | null, notas: p.notas as string | null,
    tonalidad: (p.tonalidad as string | null) ?? null, bpm: p.bpm == null ? null : Number(p.bpm),
    drive_folder_id: (p.drive_folder_id as string | null) ?? null,
    plataforma: (p.plataforma as string | null) ?? null,
    fecha_publicacion: (p.fecha_publicacion as string | null) ?? null,
    link_post: (p.link_post as string | null) ?? null,
    metricas: metricasPorCode.get(extraerShortcode(p.link_post as string | null) ?? "") ?? null,
    tareas, progreso,
    revisionActual: Number(p.revision_actual) || 0,
    contactoEmail: contactoRaw?.email ?? null,
    contactoTelefono: contactoRaw?.telefono ?? null,
    pagos,
    contratos: (contratosRes.data ?? []).map((c) => ({
      id: c.id as string, folio: (c.folio as string | null) ?? null, estado: c.estado as string,
      monto: Number(c.monto) || 0, moneda: (c.moneda as string | null) ?? null, created_at: c.created_at as string,
    })),
    cotizacion: cotizacionRes.data
      ? { id: cotizacionRes.data.id, folio: cotizacionRes.data.folio ?? null, estado: cotizacionRes.data.estado, created_at: cotizacionRes.data.created_at }
      : null,
    renderJobs: (renderJobsRes.data ?? []).map((r) => ({
      id: r.id as string, tipo: r.tipo as string, estado: r.estado as string,
      tarea_id: (r.tarea_id as string | null) ?? null, created_at: r.created_at as string,
      drive_urls: (r.drive_urls as string[] | null) ?? null,
    })),
    renderInventario: (renderInvRes.data ?? []) as RenderInventarioItem[],
    actividad: (actividadRes.data ?? []) as ActividadItem[],
    diasParaEntrega, diasDeAtraso, saludEntrega,
    entregasReferencia: referencia,
  };
}

// ─── Rendimiento del equipo ──────────────────────────────────────────────────
export interface RendEquipo { id: string; nombre: string; email: string | null; rol: string; pago_variable: boolean }
export interface RendTarea {
  responsable_id: string | null; hecho: boolean; completado_at: string | null; created_at: string | null;
  titulo: string; clase: string | null; tipo: string | null; fecha_entrega: string | null;
}
export interface RendProyectoMin { id: string; responsable_id: string | null; responsables: string[]; estado: string; fecha_entrega: string | null }
export interface RendHora { equipo_id: string; fecha: string; horas: number }
/** Una pieza de contenido publicada con su rendimiento real (ligado por shortcode). */
export interface RendContenido { responsable_id: string | null; fecha: string | null; reproducciones: number; interacciones: number }

const TIPOS_CONTENIDO_REND = ["creacion_contenido", "contenido", "beat"];

export async function getRendimiento(): Promise<{
  equipo: RendEquipo[]; tareas: RendTarea[]; proyectos: RendProyectoMin[]; horas: RendHora[]; contenido: RendContenido[];
}> {
  const sb = supabaseAdmin();
  const [eqRes, prRes, tRes, hRes, spRes] = await Promise.all([
    sb.from("equipo").select("id, nombre, email, rol, pago_variable, activo"),
    sb.from("proyectos").select("id, responsable_id, responsables, estado, fecha_entrega, clase, tipo, link_post, fecha_publicacion"),
    sb.from("proyecto_tareas").select("responsable_id, hecho, completado_at, created_at, titulo, proyecto_id, link_post, fecha"),
    sb.from("equipo_horas").select("equipo_id, fecha, horas"),
    sb.from("social_posts").select("permalink, likes, comentarios, guardados, compartidos, reproducciones"),
  ]);

  // Ligar posts a piezas de contenido por shortcode → rendimiento real por persona.
  const socialPorCode = new Map<string, { reproducciones: number; interacciones: number }>();
  for (const sp of spRes.data ?? []) {
    const code = extraerShortcode(sp.permalink as string | null);
    if (!code) continue;
    const inter = (Number(sp.likes) || 0) + (Number(sp.comentarios) || 0) + (Number(sp.guardados) || 0) + (Number(sp.compartidos) || 0);
    socialPorCode.set(code, { reproducciones: Number(sp.reproducciones) || 0, interacciones: inter });
  }
  const contenido: RendContenido[] = [];
  const vistos = new Set<string>();
  const pushContenido = (responsable_id: string | null, fecha: string | null, code: string | null) => {
    if (!code) return;
    const m = socialPorCode.get(code);
    if (!m) return;
    const key = `${responsable_id ?? "?"}|${code}`; // dedupe: un mismo post no cuenta doble por persona
    if (vistos.has(key)) return;
    vistos.add(key);
    contenido.push({ responsable_id, fecha, reproducciones: m.reproducciones, interacciones: m.interacciones });
  };
  // Nivel tarea: cada reel es una tarea con su link (fuente principal).
  for (const t of tRes.data ?? []) {
    pushContenido((t.responsable_id as string) ?? null, (t.fecha as string) ?? (t.completado_at as string) ?? null, extraerShortcode(t.link_post as string | null));
  }
  // Nivel proyecto: cuando un proyecto de contenido ES una sola pieza.
  for (const p of prRes.data ?? []) {
    const tipo = (p.tipo as string | null) ?? null;
    if (!tipo || !TIPOS_CONTENIDO_REND.includes(tipo)) continue;
    pushContenido((p.responsable_id as string) ?? null, (p.fecha_publicacion as string) ?? (p.fecha_entrega as string) ?? null, extraerShortcode(p.link_post as string | null));
  }

  const proyMap = new Map<string, { clase: string | null; tipo: string | null; fecha_entrega: string | null }>();
  const proyectos: RendProyectoMin[] = [];
  for (const p of prRes.data ?? []) {
    proyMap.set(p.id as string, { clase: (p.clase as string) ?? null, tipo: (p.tipo as string) ?? null, fecha_entrega: (p.fecha_entrega as string) ?? null });
    proyectos.push({ id: p.id as string, responsable_id: (p.responsable_id as string) ?? null, responsables: ((p.responsables as string[] | null) ?? []), estado: p.estado as string, fecha_entrega: (p.fecha_entrega as string) ?? null });
  }

  const tareas: RendTarea[] = (tRes.data ?? []).map((t) => {
    const pm = proyMap.get(t.proyecto_id as string) ?? { clase: null, tipo: null, fecha_entrega: null };
    return {
      responsable_id: (t.responsable_id as string) ?? null, hecho: Boolean(t.hecho),
      completado_at: (t.completado_at as string) ?? null, created_at: (t.created_at as string) ?? null,
      titulo: t.titulo as string, clase: pm.clase, tipo: pm.tipo, fecha_entrega: pm.fecha_entrega,
    };
  });

  const equipo: RendEquipo[] = (eqRes.data ?? [])
    .filter((e) => e.activo !== false)
    .map((e) => ({ id: e.id as string, nombre: e.nombre as string, email: (e.email as string) ?? null, rol: e.rol as string, pago_variable: Boolean(e.pago_variable) }));
  const horas: RendHora[] = (hRes.data ?? []).map((h) => ({ equipo_id: h.equipo_id as string, fecha: h.fecha as string, horas: Number(h.horas) || 0 }));

  return { equipo, tareas, proyectos, horas, contenido };
}

// ─── Resumen para encabezados ────────────────────────────────────────────────
export function crmResumen(contactos: Contacto[]) {
  const porEtapa: Record<string, number> = {};
  for (const c of contactos) porEtapa[c.etapa] = (porEtapa[c.etapa] ?? 0) + 1;
  const clientes = contactos.filter((c) => c.etapa === "cliente" || c.etapa === "recurrente");
  return {
    total: contactos.length,
    porEtapa,
    clientes: clientes.length,
    ltvTotal: clientes.reduce((a, c) => a + c.ltv, 0),
  };
}
