"use client";
import { useState, useMemo } from "react";
import { Clock, Target, AlertTriangle, TrendingUp, Users, Wrench } from "lucide-react";
import { KpiCard, HBars, LineChart } from "@/components/admin/charts";
import { calcEntregas, type DashProyecto, type EntregasResumen } from "@/lib/entregas";
import { ESTADO_PROY_LABEL, TIPO_PROY_LABEL } from "@/lib/erp-data";

const CLASES = [
  { k: "cliente", label: "Cliente", icon: Users },
  { k: "interno", label: "Interno", icon: Wrench },
  { k: "todos", label: "Todos", icon: null },
] as const;

const d = (n: number | null, dec = 0) => (n === null ? "—" : `${n.toFixed(dec).replace(/\.0$/, "")}d`);
const pctFmt = (n: number | null) => (n === null ? "—" : `${Math.round(n)}%`);

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

export function EntregasPanel({ proyectos, inPeriod, periodLabel }: {
  proyectos: DashProyecto[];
  inPeriod: (fecha?: string | null) => boolean;
  periodLabel: string;
}) {
  const [clase, setClase] = useState<string>("cliente");

  const filtrar = (c: string) =>
    proyectos.filter((p) => (c === "todos" ? true : c === "cliente" ? p.esCliente : !p.esCliente));

  // Las ENTREGAS se filtran por periodo (fecha de entrega real); el WIP es "ahora".
  const resumenDe = (c: string): EntregasResumen => {
    const base = filtrar(c);
    const enPeriodo = base.filter((p) => !p.fechaEntregaReal || inPeriod(p.fechaEntregaReal));
    return calcEntregas(enPeriodo);
  };

  const r = useMemo(() => resumenDe(clase), [proyectos, clase, inPeriod]); // eslint-disable-line react-hooks/exhaustive-deps
  const rCliente = useMemo(() => resumenDe("cliente"), [proyectos, inPeriod]); // eslint-disable-line react-hooks/exhaustive-deps
  const rInterno = useMemo(() => resumenDe("interno"), [proyectos, inPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  // Umbral de alerta para el WIP: 1.5× la mediana histórica (o 21d si no hay).
  const umbral = (r.mediana ?? 14) * 1.5;
  const tonoEdad = (edad: number) =>
    edad >= umbral ? "text-red-300 bg-red-500/10 border-red-400/25"
      : edad >= (r.mediana ?? 14) ? "text-amber-300 bg-amber-500/10 border-amber-400/25"
      : "text-white/60 bg-white/5 border-white/10";

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs transition-colors flex items-center gap-1.5 ${active ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`;

  const arranque = clase === "interno" ? "desde que se creó el proyecto"
    : clase === "cliente" ? "desde la fecha de la venta"
    : "desde la venta (o creación si no hay venta)";

  return (
    <div className="space-y-4">
      {/* Filtro de clasificación */}
      <div className="flex items-center gap-2 flex-wrap">
        {CLASES.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.k} onClick={() => setClase(c.k)} className={chip(clase === c.k)}>
              {Icon ? <Icon size={12} /> : null}{c.label}
            </button>
          );
        })}
        <span className="text-white/30 text-[11px] ml-1">
          {r.n === 0 ? "sin entregas en el periodo" : `n=${r.n} entrega${r.n === 1 ? "" : "s"}`}
          {r.n > 0 && ` · ${r.desdeVenta}/${r.n} medidas desde la venta`}
          {" · "}{arranque}
        </span>
      </div>

      {r.n === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
          <p className="text-white/50 text-sm">Sin proyectos entregados en <span className="capitalize">{periodLabel}</span>.</p>
          <p className="text-white/30 text-xs mt-1">El reloj se detiene cuando mueves el proyecto a <b>Entregado</b> en Producción.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Mediana de entrega" value={d(r.mediana, 1)} accent icon={<Clock size={12} />}
              sub={`prom ${d(r.promedio, 1)} · rango ${d(r.min)}–${d(r.max)}`} />
            <KpiCard label="Entregado a tiempo" value={pctFmt(r.pctATiempo)} icon={<Target size={12} />}
              sub={r.conFechaComprometida > 0 ? `${r.conFechaComprometida} con fecha comprometida` : "nadie tenía fecha"} />
            <KpiCard label="Retraso promedio" value={r.retrasoProm === null ? "—" : d(r.retrasoProm, 1)} icon={<AlertTriangle size={12} />}
              sub="de los que llegaron tarde" />
            <KpiCard label="Peor caso (P90)" value={d(r.p90)} icon={<TrendingUp size={12} />}
              sub="usa esto para comprometer" />
          </div>

          {/* Comparativa cliente vs interno */}
          {clase === "todos" && rCliente.n > 0 && rInterno.n > 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
              <h2 className="font-coolvetica text-lg mb-3">Cliente vs Interno</h2>
              <div className="grid grid-cols-2 gap-3">
                {([["Cliente", rCliente], ["Interno", rInterno]] as const).map(([lbl, x]) => (
                  <div key={lbl} className="rounded-xl bg-white/[0.02] border border-white/8 px-4 py-3">
                    <p className="text-white/40 text-[10px] uppercase tracking-wider">{lbl}</p>
                    <p className="font-coolvetica text-2xl mt-0.5 tabular-nums">{d(x.mediana, 1)}</p>
                    <p className="text-white/35 text-xs mt-1">{pctFmt(x.pctATiempo)} a tiempo · n={x.n}</p>
                  </div>
                ))}
              </div>
              {rCliente.mediana !== null && rInterno.mediana !== null && rInterno.mediana > 0 && (
                <p className="text-white/40 text-xs mt-3">
                  El trabajo de cliente tarda <b className="text-white/70">{(rCliente.mediana / rInterno.mediana).toFixed(1)}×</b> lo que tarda el interno.
                </p>
              )}
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Tendencia" hint="mediana de días por mes de entrega">
              <LineChart data={r.porMes} fmt={(n) => `${Math.round(n)}d`} />
            </Panel>
            <Panel title="Por tipo de proyecto" hint="mediana · # entregas">
              <HBars rows={r.porTipo.map((t) => ({ ...t, label: TIPO_PROY_LABEL[t.label] ?? t.label }))} fmt={(n) => `${Math.round(n)}d`} />
            </Panel>
          </div>
        </>
      )}

      {/* WIP con aging — siempre visible, no depende del periodo */}
      <Panel title="En curso ahora mismo" hint={`${r.wip.length} abiertos · ámbar > ${Math.round(r.mediana ?? 14)}d · rojo > ${Math.round(umbral)}d`}>
        {r.wip.length === 0 ? (
          <p className="text-white/30 text-sm">🎉 Nada abierto en esta categoría.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {r.wip.map(({ p, edad, fuente }) => (
              <div key={p.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.titulo}</p>
                  <p className="text-white/35 text-[11px]">
                    {ESTADO_PROY_LABEL[p.estado] ?? p.estado}
                    {p.tipo ? ` · ${TIPO_PROY_LABEL[p.tipo] ?? p.tipo}` : ""}
                    <span className="text-white/20"> · {fuente === "venta" ? "desde la venta" : "desde que se creó"}</span>
                  </p>
                </div>
                <span className={`text-xs font-medium tabular-nums px-2 py-1 rounded-lg border flex-shrink-0 ${tonoEdad(edad)}`}>
                  {edad}d
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
