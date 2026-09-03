"use client";
import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { money } from "@/components/admin/ui";

// Paleta compartida para los gráficos (fuera de Tailwind por ser SVG).
const C = {
  pos: "#34d399", // ingresos / positivo
  neg: "#fb7185", // egresos / negativo
  util: "#fbbf24", // utilidad (línea)
  accent: "var(--color-lgb-red)",
} as const;

const nf = new Intl.NumberFormat("es-MX");

// ─── Delta vs periodo anterior ───────────────────────────────────────────────
/** Muestra ↑/↓ con el % de cambio. `invert` para métricas donde subir es malo (gastos). */
export function Delta({ curr, prev, invert = false }: { curr: number; prev: number | null; invert?: boolean }) {
  if (prev === null || prev === undefined) return null;
  if (prev === 0 && curr === 0) return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.005) return <span className="text-white/25 text-xs">→ 0%</span>;
  const pct = prev === 0 ? null : Math.round((diff / Math.abs(prev)) * 100);
  const up = diff > 0;
  const good = invert ? !up : up;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${good ? "text-green-400" : "text-red-400"}`} title={`Antes: ${money(prev)}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {pct === null ? "nuevo" : `${Math.abs(pct)}%`}
    </span>
  );
}

export function KpiCard({ label, value, delta, sub, accent, icon }: {
  label: string; value: ReactNode; delta?: ReactNode; sub?: string; accent?: boolean; icon?: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${accent ? "border-lgb-red/40 bg-lgb-red/5" : "border-white/8 bg-white/[0.03]"}`}>
      <p className="text-white/40 text-[11px] uppercase tracking-wider mb-2 flex items-center gap-1.5">{icon}{label}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-white font-coolvetica text-2xl sm:text-3xl leading-none tabular-nums">{value}</span>
        {delta}
      </div>
      {sub && <p className="text-white/40 text-xs mt-2">{sub}</p>}
    </div>
  );
}

// ─── Barras horizontales (desglose) ──────────────────────────────────────────
export function HBars({ rows, fmt, color = C.accent }: {
  rows: { label: string; value: number; sub?: string }[]; fmt: (n: number) => string; color?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (rows.length === 0) return <p className="text-white/30 text-sm">Sin datos en este periodo.</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/70 truncate">{r.label}{r.sub ? <span className="text-white/30"> · {r.sub}</span> : null}</span>
            <span className="text-white/90 font-medium tabular-nums flex-shrink-0 ml-2">{fmt(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.max((r.value / max) * 100, 2)}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Pareto: barras + % acumulado (concentración) ────────────────────────────
export function ParetoBars({ rows, fmt }: { rows: { label: string; value: number }[]; fmt: (n: number) => string }) {
  if (rows.length === 0) return <p className="text-white/30 text-sm">Sin datos en este periodo.</p>;
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  const max = Math.max(...rows.map((r) => r.value), 1);
  let acc = 0;
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => {
        acc += r.value;
        const cum = Math.round((acc / total) * 100);
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-white/70 truncate">{r.label}</span>
              <span className="tabular-nums flex-shrink-0 ml-2">
                <span className="text-white/90 font-medium">{fmt(r.value)}</span>
                <span className="text-lgb-red ml-2">{cum}% acum</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-lgb-red" style={{ width: `${Math.max((r.value / max) * 100, 2)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Combo mensual: ingresos vs egresos (barras) + utilidad (línea) ──────────
export interface ComboRow { label: string; ingresos: number; egresos: number; utilidad: number }
export function ComboMonthly({ data }: { data: ComboRow[] }) {
  if (data.length === 0) return <p className="text-white/30 text-sm py-10 text-center">Sin movimientos en este periodo.</p>;
  const n = data.length;
  const vals = data.flatMap((d) => [d.ingresos, d.egresos, d.utilidad]);
  const max = Math.max(...vals, 1);
  const min = Math.min(0, ...vals);
  const range = max - min || 1;
  const y = (v: number) => ((max - v) / range) * 100; // 0..100 (arriba=max)
  const zeroY = y(0);
  const bw = (0.30 / n) * 100; // ancho de cada barra en %
  const cx = (i: number) => ((i + 0.5) / n) * 100;
  const linePts = data.map((d, i) => `${cx(i)},${y(d.utilidad)}`).join(" ");

  return (
    <div>
      <div className="flex gap-4 mb-3 text-[11px] flex-wrap">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: C.pos }} /> Ingresos</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: C.neg }} /> Egresos</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-0.5 inline-block" style={{ background: C.util }} /> Utilidad</span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-44">
        <line x1="0" y1={zeroY} x2="100" y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeWidth="0.4" />
        {data.map((d, i) => {
          const c = cx(i);
          const iy = y(d.ingresos), ey = y(d.egresos);
          return (
            <g key={d.label}>
              <rect x={c - bw - 0.4} y={Math.min(iy, zeroY)} width={bw} height={Math.abs(zeroY - iy)} fill={C.pos} opacity="0.85">
                <title>{`${d.label} · Ingresos ${money(d.ingresos)}`}</title>
              </rect>
              <rect x={c + 0.4} y={Math.min(ey, zeroY)} width={bw} height={Math.abs(zeroY - ey)} fill={C.neg} opacity="0.85">
                <title>{`${d.label} · Egresos ${money(d.egresos)}`}</title>
              </rect>
            </g>
          );
        })}
        <polyline points={linePts} fill="none" stroke={C.util} strokeWidth="1.6" vectorEffect="non-scaling-stroke"
          strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="flex mt-1.5">
        {data.map((d) => <span key={d.label} className="flex-1 text-center text-white/35 text-[10px] capitalize truncate">{d.label}</span>)}
      </div>
    </div>
  );
}

// ─── Línea simple (flujo acumulado, ticket, margen) ──────────────────────────
export function LineChart({ data, fmt, color = C.accent, area = true }: {
  data: { label: string; value: number }[]; fmt: (n: number) => string; color?: string; area?: boolean;
}) {
  if (data.length === 0) return <p className="text-white/30 text-sm py-8 text-center">Sin datos.</p>;
  const pts = data.map((d) => d.value);
  const max = Math.max(...pts, 0);
  const min = Math.min(...pts, 0);
  const range = max - min || 1;
  const y = (v: number) => ((max - v) / range) * 100;
  const x = (i: number) => (data.length > 1 ? (i / (data.length - 1)) * 100 : 50);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");
  const areaD = `${line} L100,${y(min)} L0,${y(min)} Z`;
  const last = data[data.length - 1];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-white font-coolvetica text-2xl tabular-nums">{fmt(last.value)}</span>
        <span className="text-white/35 text-[11px] capitalize">{last.label}</span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-24">
        {area && <path d={areaD} fill={color} opacity="0.12" />}
        <path d={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {min < 0 && <line x1="0" y1={y(0)} x2="100" y2={y(0)} stroke="rgba(255,255,255,0.15)" strokeWidth="0.4" />}
      </svg>
      <div className="flex justify-between text-white/25 text-[10px] mt-1">
        <span className="capitalize">{data[0]?.label}</span><span className="capitalize">{last.label}</span>
      </div>
    </div>
  );
}

// ─── Embudo comercial con tasas de conversión ────────────────────────────────
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const first = steps[0]?.value || 0;
  if (first === 0) return <p className="text-white/30 text-sm">Sin contactos para el embudo.</p>;
  return (
    <div className="flex flex-col gap-1">
      {steps.map((s, i) => {
        const wPct = Math.max((s.value / first) * 100, 3);
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={s.label}>
            {i > 0 && (
              <div className="text-center text-[10px] text-white/30 py-0.5">
                ▼ {conv !== null ? `${conv}%` : "—"}
              </div>
            )}
            <div className="relative h-10 rounded-lg bg-white/5 overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-lgb-red to-lgb-red/60" style={{ width: `${wPct}%` }} />
              <div className="absolute inset-0 flex items-center justify-between px-3 text-xs">
                <span className="text-white font-medium">{s.label}</span>
                <span className="text-white/90 tabular-nums">{nf.format(s.value)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Barras apiladas (nuevos vs recurrentes por mes) ─────────────────────────
export function StackedBars({ data, labels }: {
  data: { label: string; a: number; b: number }[]; labels: [string, string];
}) {
  if (data.length === 0) return <p className="text-white/30 text-sm py-8 text-center">Sin datos.</p>;
  const max = Math.max(...data.map((d) => d.a + d.b), 1);
  return (
    <div>
      <div className="flex gap-4 mb-3 text-[11px] flex-wrap">
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: C.pos }} /> {labels[0]}</span>
        <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block bg-lgb-red" /> {labels[1]}</span>
      </div>
      <div className="flex items-end justify-between gap-2 h-36">
        {data.map((d) => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <div className="w-full max-w-[38px] flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: `${((d.a + d.b) / max) * 100}%` }}>
              <div style={{ height: `${((d.a) / (d.a + d.b || 1)) * 100}%`, background: C.pos }} title={`${labels[0]}: ${money(d.a)}`} />
              <div className="bg-lgb-red" style={{ height: `${((d.b) / (d.a + d.b || 1)) * 100}%` }} title={`${labels[1]}: ${money(d.b)}`} />
            </div>
            <span className="text-white/35 text-[10px] capitalize truncate w-full text-center">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
