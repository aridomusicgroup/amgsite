"use client";
import { useState, useMemo, useCallback } from "react";
import { StatCard, money } from "@/components/admin/ui";
import { KpiCard, Delta, HBars, ParetoBars, ComboMonthly, LineChart, Funnel, StackedBars, type ComboRow } from "@/components/admin/charts";
import { EntregasPanel } from "@/components/admin/EntregasPanel";
import { ETAPA_LABEL, ETAPAS } from "@/lib/erp-data";
import type { DashVenta, DashIngreso, DashEgreso, DashContacto, DashProyecto } from "@/lib/erp-data";

const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", tiktok: "TikTok", beatstars: "BeatStars", facebook: "Facebook", sitio: "Sitio web",
};
const PERIODOS = [
  { k: "mes", label: "Este mes" },
  { k: "30", label: "30 días" },
  { k: "90", label: "90 días" },
  { k: "365", label: "12 meses" },
  { k: "todo", label: "Todo" },
] as const;
const TABS = ["Resumen", "Ingresos", "Egresos", "Comercial", "Clientes", "Entregas"] as const;
// Etapas que forman el embudo lineal (perdido/inactivo son salidas, no pasos).
const EMBUDO = ["lead", "negociacion", "cliente", "recurrente"] as const;

const mesCorto = (k: string) => new Date(k + "-15T12:00:00").toLocaleDateString("es-MX", { month: "short" });
const mesLargo = (k: string) => new Date(k + "-15T12:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });
const num = (n: number) => String(n);
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n)}%`);

// Suma agrupada por clave.
function groupSum<T>(list: T[], keyFn: (x: T) => string | null, valFn: (x: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of list) { const k = keyFn(x); if (!k) continue; m.set(k, (m.get(k) ?? 0) + valFn(x)); }
  return m;
}

function Panel({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h2 className="font-coolvetica text-lg">{title}</h2>
        {hint && <span className="text-white/30 text-[11px]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

interface RevEvent { fecha: string; monto: number; canal: string | null; tipo: string | null; beat_nombre: string | null; cliente: string | null }

export function Dashboard({ ventas, ingresos, egresos, contactos, proyectos }: {
  ventas: DashVenta[]; ingresos: DashIngreso[]; egresos: DashEgreso[]; contactos: DashContacto[];
  proyectos: DashProyecto[];
}) {
  const [periodo, setPeriodo] = useState<string>("mes");
  const [canal, setCanal] = useState("todos");
  const [tipoF, setTipoF] = useState("todos");
  const [clienteF, setClienteF] = useState("todos");
  const [base, setBase] = useState<"caja" | "devengado">("caja");
  const [incluirCapex, setIncluirCapex] = useState(false);
  const [tab, setTab] = useState<string>("Resumen");

  const thisMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const cutoffDays = useMemo(() => {
    if (!/^\d+$/.test(periodo)) return null;
    const d = new Date(); d.setDate(d.getDate() - Number(periodo));
    return d.toISOString().slice(0, 10);
  }, [periodo]);

  const inPeriod = useCallback((fecha?: string | null) => {
    if (!fecha) return false;
    const f = fecha.slice(0, 10);
    if (periodo === "todo") return true;
    if (periodo === "mes") return f.slice(0, 7) === thisMonth;
    if (/^\d{4}-\d{2}$/.test(periodo)) return f.slice(0, 7) === periodo;
    return cutoffDays ? f >= cutoffDays : true;
  }, [periodo, thisMonth, cutoffDays]);

  // Ventana anterior equivalente (para comparar). null = sin comparación.
  const prevWin = useMemo(() => {
    if (periodo === "todo") return null;
    if (periodo === "mes") { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return { ym: d.toISOString().slice(0, 7) }; }
    if (/^\d{4}-\d{2}$/.test(periodo)) { const d = new Date(periodo + "-01T12:00:00"); d.setMonth(d.getMonth() - 1); return { ym: d.toISOString().slice(0, 7) }; }
    const n = Number(periodo);
    const end = new Date(); end.setDate(end.getDate() - n);
    const start = new Date(); start.setDate(start.getDate() - 2 * n);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }, [periodo]);

  const inPrev = useCallback((fecha?: string | null) => {
    if (!fecha || !prevWin) return false;
    const f = fecha.slice(0, 10);
    if ("ym" in prevWin) return f.slice(0, 7) === prevWin.ym;
    return f >= prevWin.start && f < prevWin.end;
  }, [prevWin]);

  const matchDim = useCallback((x: { canal: string | null; tipo: string | null; cliente: string | null }) =>
    (canal === "todos" || x.canal === canal) && (tipoF === "todos" || x.tipo === tipoF) && (clienteF === "todos" || x.cliente === clienteF),
    [canal, tipoF, clienteF]);

  // ── Opciones de filtros ──
  const canales = useMemo(() => ["todos", ...new Set(ventas.map((v) => v.canal).filter(Boolean) as string[])], [ventas]);
  const tipos = useMemo(() => ["todos", ...new Set([...ventas.map((v) => v.tipo), ...ingresos.map((i) => i.tipo)].filter(Boolean) as string[])], [ventas, ingresos]);
  const clientesList = useMemo(() => ["todos", ...[...new Set(ventas.map((v) => v.cliente).filter(Boolean) as string[])].sort()], [ventas]);
  const meses = useMemo(() => {
    const s = new Set<string>();
    for (const x of ingresos) if (x.fecha) s.add(x.fecha.slice(0, 7));
    for (const v of ventas) if (v.fecha) s.add(v.fecha.slice(0, 7));
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [ingresos, ventas]);

  // ── Filtrados (periodo actual / anterior) ──
  const fi = useMemo(() => ingresos.filter((x) => inPeriod(x.fecha) && matchDim(x)), [ingresos, inPeriod, matchDim]);
  const fv = useMemo(() => ventas.filter((v) => inPeriod(v.fecha) && matchDim(v)), [ventas, inPeriod, matchDim]);
  const fe = useMemo(() => egresos.filter((e) => inPeriod(e.fecha)), [egresos, inPeriod]);
  const fc = useMemo(() => contactos.filter((c) => inPeriod((c.created_at || "").slice(0, 10))), [contactos, inPeriod]);
  const piv = useMemo(() => ingresos.filter((x) => inPrev(x.fecha) && matchDim(x)), [ingresos, inPrev, matchDim]);
  const pfv = useMemo(() => ventas.filter((v) => inPrev(v.fecha) && matchDim(v)), [ventas, inPrev, matchDim]);
  const pfe = useMemo(() => egresos.filter((e) => inPrev(e.fecha)), [egresos, inPrev]);
  const pfc = useMemo(() => contactos.filter((c) => inPrev((c.created_at || "").slice(0, 10))), [contactos, inPrev]);

  // Base contable: caja (cobros) o devengado (ventas por su fecha).
  const toRev = useCallback((vs: DashVenta[]): RevEvent[] =>
    vs.map((v) => ({ fecha: v.fecha, monto: v.total_mxn, canal: v.canal, tipo: v.tipo, beat_nombre: v.beat_nombre, cliente: v.cliente })), []);
  const rev: RevEvent[] = useMemo(() => (base === "caja" ? fi : toRev(fv)), [base, fi, fv, toRev]);
  const revPrev: RevEvent[] = useMemo(() => (base === "caja" ? piv : toRev(pfv)), [base, piv, pfv, toRev]);

  const gastoDe = useCallback((list: DashEgreso[]) => list.filter((e) => incluirCapex || !e.es_capex).reduce((a, e) => a + e.total_mxn, 0), [incluirCapex]);

  // ── KPIs actuales y anteriores ──
  const ingresosTot = rev.reduce((a, x) => a + x.monto, 0);
  const ingresosPrev = revPrev.reduce((a, x) => a + x.monto, 0);
  const costosDir = fv.reduce((a, v) => a + v.costo_extra, 0);
  const costosPrev = pfv.reduce((a, v) => a + v.costo_extra, 0);
  const gastosOp = gastoDe(fe);
  const gastosPrev = gastoDe(pfe);
  const utilidad = ingresosTot - costosDir - gastosOp;
  const utilidadPrev = ingresosPrev - costosPrev - gastosPrev;
  const ticket = fv.length ? ingresosTot / fv.length : 0;
  const ticketPrev = pfv.length ? ingresosPrev / pfv.length : 0;
  const margen = ingresosTot > 0 ? (utilidad / ingresosTot) * 100 : null;
  const margenPrev = ingresosPrev > 0 ? (utilidadPrev / ingresosPrev) * 100 : null;

  // ── Series mensuales ──
  const monthly: ComboRow[] = useMemo(() => {
    const ing = groupSum(rev, (x) => x.fecha?.slice(0, 7), (x) => x.monto);
    const cos = groupSum(fv, (v) => v.fecha?.slice(0, 7), (v) => v.costo_extra);
    const gas = groupSum(fe.filter((e) => incluirCapex || !e.es_capex), (e) => e.fecha?.slice(0, 7), (e) => e.total_mxn);
    const keys = new Set([...ing.keys(), ...gas.keys()]);
    return [...keys].sort().slice(-12).map((k) => {
      const i = ing.get(k) ?? 0, g = (gas.get(k) ?? 0) + (cos.get(k) ?? 0);
      return { label: mesCorto(k), ingresos: i, egresos: g, utilidad: i - g };
    });
  }, [rev, fv, fe, incluirCapex]);

  const flujoAcum = useMemo(() => {
    let acc = 0;
    return monthly.map((m) => { acc += m.utilidad; return { label: m.label, value: acc }; });
  }, [monthly]);

  const ticketMensual = useMemo(() => {
    const ing = groupSum(rev, (x) => x.fecha?.slice(0, 7), (x) => x.monto);
    const cnt = groupSum(fv, (v) => v.fecha?.slice(0, 7), () => 1);
    return [...ing.keys()].sort().slice(-12).map((k) => ({ label: mesCorto(k), value: (cnt.get(k) ?? 0) > 0 ? (ing.get(k) ?? 0) / (cnt.get(k) as number) : 0 }));
  }, [rev, fv]);

  const egresosMensual = useMemo(() => {
    const gas = groupSum(fe.filter((e) => incluirCapex || !e.es_capex), (e) => e.fecha?.slice(0, 7), (e) => e.total_mxn);
    return [...gas.keys()].sort().slice(-12).map((k) => ({ label: mesCorto(k), value: gas.get(k) ?? 0 }));
  }, [fe, incluirCapex]);

  // ── Desgloses ──
  const valueBy = useCallback((key: (x: RevEvent) => string | null) => groupSum(rev, key, (x) => x.monto), [rev]);
  const countBy = useCallback((key: (v: DashVenta) => string | null) => groupSum(fv, key, () => 1), [fv]);

  const porCanal = useMemo(() => {
    const val = valueBy((x) => x.canal), cnt = countBy((v) => v.canal);
    return [...new Set([...val.keys(), ...cnt.keys()])].map((k) => ({ label: CANAL_LABEL[k] ?? k, value: val.get(k) ?? 0, count: cnt.get(k) ?? 0 })).sort((a, b) => b.value - a.value);
  }, [valueBy, countBy]);
  const porTipo = useMemo(() => {
    const val = valueBy((x) => x.tipo), cnt = countBy((v) => v.tipo);
    return [...val.keys()].map((k) => ({ label: k, value: val.get(k) ?? 0, sub: `${cnt.get(k) ?? 0}` })).sort((a, b) => b.value - a.value);
  }, [valueBy, countBy]);
  const topBeats = useMemo(() => {
    const val = valueBy((x) => x.beat_nombre), cnt = countBy((v) => v.beat_nombre);
    return [...val.keys()].map((k) => ({ label: k, value: val.get(k) ?? 0, sub: `${cnt.get(k) ?? 0}` })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [valueBy, countBy]);
  const topClientes = useMemo(() => {
    const val = valueBy((x) => x.cliente), cnt = countBy((v) => v.cliente);
    return [...val.keys()].map((k) => ({ label: k, value: val.get(k) ?? 0, sub: `${cnt.get(k) ?? 0}` })).sort((a, b) => b.value - a.value);
  }, [valueBy, countBy]);

  // Concentración: qué % de ingresos viene del top 3.
  const concentracion = useMemo(() => {
    const total = topClientes.reduce((a, r) => a + r.value, 0);
    const top3 = topClientes.slice(0, 3).reduce((a, r) => a + r.value, 0);
    return total > 0 ? Math.round((top3 / total) * 100) : null;
  }, [topClientes]);

  // Mix de ingresos (siempre sobre cobros): ventas vs otros ingresos.
  const mix = useMemo(() => {
    const otros = fi.filter((x) => x.tipo === "Otro ingreso").reduce((a, x) => a + x.monto, 0);
    const propios = fi.filter((x) => x.tipo !== "Otro ingreso").reduce((a, x) => a + x.monto, 0);
    return [
      { label: "Ventas de beats / servicios", value: propios },
      { label: "Otros ingresos (streaming · YouTube · payouts)", value: otros },
    ].filter((r) => r.value > 0);
  }, [fi]);

  // Egresos por categoría + CAPEX vs OPEX.
  const gastosCategoria = useMemo(() => {
    const m = groupSum(fe, (e) => e.categoria ?? "Sin categoría", (e) => e.total_mxn);
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [fe]);
  const capexOpex = useMemo(() => {
    const capex = fe.filter((e) => e.es_capex).reduce((a, e) => a + e.total_mxn, 0);
    const opex = fe.filter((e) => !e.es_capex).reduce((a, e) => a + e.total_mxn, 0);
    return { capex, opex };
  }, [fe]);

  // Nuevos vs recurrentes por mes (primera compra global del cliente).
  const nuevosVsRec = useMemo(() => {
    const primeraCompra = new Map<string, string>();
    for (const v of ventas) {
      if (!v.cliente || !v.fecha) continue;
      const prev = primeraCompra.get(v.cliente);
      if (!prev || v.fecha < prev) primeraCompra.set(v.cliente, v.fecha);
    }
    const nuevo = new Map<string, number>(), recu = new Map<string, number>();
    for (const v of fv) {
      if (!v.fecha) continue;
      const k = v.fecha.slice(0, 7);
      const esNuevo = v.cliente && primeraCompra.get(v.cliente) === v.fecha;
      const target = esNuevo ? nuevo : recu;
      target.set(k, (target.get(k) ?? 0) + v.total_mxn);
    }
    const keys = new Set([...nuevo.keys(), ...recu.keys()]);
    return [...keys].sort().slice(-12).map((k) => ({ label: mesCorto(k), a: nuevo.get(k) ?? 0, b: recu.get(k) ?? 0 }));
  }, [ventas, fv]);

  // Embudo (todos los contactos, no depende del periodo).
  const embudo = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contactos) m.set(c.etapa, (m.get(c.etapa) ?? 0) + 1);
    // Acumulado: quien es "recurrente" también pasó por "cliente", etc.
    const idx = (e: string) => (EMBUDO as readonly string[]).indexOf(e);
    return EMBUDO.map((e, i) => {
      let v = 0;
      for (const [etapa, n] of m) { const ei = idx(etapa); if (ei >= i) v += n; }
      return { label: ETAPA_LABEL[e] ?? e, value: v };
    });
  }, [contactos]);

  const topLTV = useMemo(() =>
    [...contactos].filter((c) => c.ltv > 0 && c.nombre).sort((a, b) => b.ltv - a.ltv).slice(0, 8)
      .map((c) => ({ label: c.nombre as string, value: c.ltv })), [contactos]);

  const porEtapa = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contactos) m.set(c.etapa, (m.get(c.etapa) ?? 0) + 1);
    return (ETAPAS as readonly string[]).filter((e) => m.has(e)).map((e) => ({ label: ETAPA_LABEL[e] ?? e, value: m.get(e) ?? 0 }));
  }, [contactos]);
  const porOrigen = useMemo(() => {
    const m = groupSum(contactos, (c) => c.origen, () => 1);
    return [...m.entries()].map(([k, v]) => ({ label: CANAL_LABEL[k] ?? k, value: v })).sort((a, b) => b.value - a.value);
  }, [contactos]);

  const recurrentes = contactos.filter((c) => c.etapa === "recurrente").length;

  const periodLabel = periodo === "mes" ? "Este mes"
    : /^\d{4}-\d{2}$/.test(periodo) ? mesLargo(periodo)
    : (PERIODOS.find((p) => p.k === periodo)?.label ?? "Todo");

  const chip = (active: boolean) => `px-3 py-1.5 rounded-full text-xs transition-colors ${active ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`;
  const selCls = "bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lgb-red";

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-coolvetica text-3xl">Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">
            Inteligencia del negocio · MXN · <span className="text-white/60">{base === "caja" ? "base cobrado (caja)" : "base venta (devengado)"}</span> · <span className="capitalize">{periodLabel}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {PERIODOS.map((p) => (
            <button key={p.k} onClick={() => setPeriodo(p.k)} className={chip(periodo === p.k)}>{p.label}</button>
          ))}
          <select value={/^\d{4}-\d{2}$/.test(periodo) ? periodo : ""} onChange={(e) => e.target.value && setPeriodo(e.target.value)} className={`${selCls} capitalize`}>
            <option value="" className="bg-lgb-dark">Mes específico…</option>
            {meses.map((m) => <option key={m} value={m} className="bg-lgb-dark capitalize">{mesLargo(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Filtros secundarios */}
      <div className="flex gap-2 items-center flex-wrap mb-5">
        <select value={canal} onChange={(e) => setCanal(e.target.value)} className={selCls}>
          {canales.map((c) => <option key={c} value={c} className="bg-lgb-dark">{c === "todos" ? "Todos los canales" : CANAL_LABEL[c] ?? c}</option>)}
        </select>
        <select value={tipoF} onChange={(e) => setTipoF(e.target.value)} className={selCls}>
          {tipos.map((t) => <option key={t} value={t} className="bg-lgb-dark">{t === "todos" ? "Todos los tipos" : t}</option>)}
        </select>
        <select value={clienteF} onChange={(e) => setClienteF(e.target.value)} className={`${selCls} max-w-[180px]`}>
          {clientesList.map((c) => <option key={c} value={c} className="bg-lgb-dark">{c === "todos" ? "Todos los clientes" : c}</option>)}
        </select>
        <div className="flex rounded-lg border border-white/10 overflow-hidden text-xs">
          <button onClick={() => setBase("caja")} className={`px-3 py-1.5 ${base === "caja" ? "bg-lgb-red text-white" : "text-white/50 hover:text-white"}`}>Caja</button>
          <button onClick={() => setBase("devengado")} className={`px-3 py-1.5 ${base === "devengado" ? "bg-lgb-red text-white" : "text-white/50 hover:text-white"}`}>Devengado</button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer select-none">
          <input type="checkbox" checked={incluirCapex} onChange={(e) => setIncluirCapex(e.target.checked)} className="accent-lgb-red" />
          Incluir CAPEX
        </label>
      </div>

      {/* KPIs con comparación */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Ingresos" value={money(ingresosTot)} accent delta={<Delta curr={ingresosTot} prev={prevWin ? ingresosPrev : null} />} />
        <KpiCard label="Utilidad" value={money(utilidad)} delta={<Delta curr={utilidad} prev={prevWin ? utilidadPrev : null} />} sub={utilidad >= 0 ? "👍" : "⚠️ en rojo"} />
        <KpiCard label="Margen" value={pct(margen)} delta={<Delta curr={margen ?? 0} prev={prevWin ? margenPrev : null} />} />
        <KpiCard label="Ventas" value={num(fv.length)} delta={<Delta curr={fv.length} prev={prevWin ? pfv.length : null} />} sub={`ticket ${money(ticket)}`} />
        <KpiCard label="Costos+gastos" value={money(costosDir + gastosOp)} delta={<Delta curr={costosDir + gastosOp} prev={prevWin ? costosPrev + gastosPrev : null} invert />} />
        <KpiCard label="Clientes nuevos" value={num(fc.length)} delta={<Delta curr={fc.length} prev={prevWin ? pfc.length : null} />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={chip(tab === t)}>{t}</button>)}
      </div>

      {tab === "Resumen" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Panel title="Ingresos · Egresos · Utilidad por mes">
              <ComboMonthly data={monthly} />
            </Panel>
          </div>
          <Panel title="Flujo de caja acumulado" hint="utilidad corrida">
            <LineChart data={flujoAcum} fmt={money} />
          </Panel>
          <div className="lg:col-span-2"><Panel title="Ingresos por canal"><HBars rows={porCanal} fmt={money} /></Panel></div>
          <Panel title="Ticket promedio por mes"><LineChart data={ticketMensual} fmt={money} color="var(--color-lgb-red)" /></Panel>
        </div>
      )}

      {tab === "Ingresos" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Mix de ingresos"><HBars rows={mix} fmt={money} color="#34d399" /></Panel>
          <Panel title="Ticket promedio por mes"><LineChart data={ticketMensual} fmt={money} /></Panel>
          <Panel title="Ingresos por tipo"><HBars rows={porTipo} fmt={money} /></Panel>
          <Panel title="Top beats vendidos"><HBars rows={topBeats} fmt={money} /></Panel>
          <div className="lg:col-span-2"><Panel title="Ingresos por canal"><HBars rows={porCanal} fmt={money} /></Panel></div>
        </div>
      )}

      {tab === "Egresos" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-3 lg:col-span-2">
            <StatCard label="OPEX (gasto operativo)" value={money(capexOpex.opex)} />
            <StatCard label="CAPEX (inversión)" value={money(capexOpex.capex)} />
          </div>
          <Panel title="Gastos por categoría"><HBars rows={gastosCategoria} fmt={money} color="#fb7185" /></Panel>
          <Panel title="Egresos por mes" hint={incluirCapex ? "incl. CAPEX" : "solo OPEX"}><LineChart data={egresosMensual} fmt={money} color="#fb7185" /></Panel>
        </div>
      )}

      {tab === "Comercial" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Embudo comercial" hint="acumulado · % conversión"><Funnel steps={embudo} /></Panel>
          <Panel title="Contactos por origen"><HBars rows={porOrigen} fmt={num} /></Panel>
          <div className="lg:col-span-2"><Panel title="Ingresos: clientes nuevos vs recurrentes por mes"><StackedBars data={nuevosVsRec} labels={["Nuevos", "Recurrentes"]} /></Panel></div>
        </div>
      )}

      {tab === "Clientes" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="grid grid-cols-4 gap-3 lg:col-span-2">
            <StatCard label="Contactos" value={num(contactos.length)} />
            <StatCard label="Recurrentes" value={num(recurrentes)} />
            <StatCard label="Nuevos (periodo)" value={num(fc.length)} />
            <StatCard label="Top 3 = " value={concentracion === null ? "—" : `${concentracion}%`} sub="de tus ingresos" />
          </div>
          <Panel title="Top clientes (periodo)" hint="por ingreso"><HBars rows={topClientes.slice(0, 8)} fmt={money} /></Panel>
          <Panel title="Concentración de clientes" hint="riesgo de dependencia"><ParetoBars rows={topClientes.slice(0, 8)} fmt={money} /></Panel>
          <Panel title="Top clientes por LTV" hint="valor de vida"><HBars rows={topLTV} fmt={money} /></Panel>
          <Panel title="Contactos por etapa"><HBars rows={porEtapa} fmt={num} /></Panel>
        </div>
      )}

      {tab === "Entregas" && (
        <EntregasPanel proyectos={proyectos} inPeriod={inPeriod} periodLabel={periodLabel} />
      )}
    </div>
  );
}
