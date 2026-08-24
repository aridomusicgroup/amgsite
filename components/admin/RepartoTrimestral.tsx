"use client";
import { useState } from "react";
import { money } from "@/components/admin/ui";
import type { QuarterAgg, SocioMin } from "@/lib/erp-data";

export function RepartoTrimestral({ quarters, socios }: { quarters: QuarterAgg[]; socios: SocioMin[] }) {
  const [idx, setIdx] = useState(0);
  const [reservaPct, setReservaPct] = useState(15);

  if (quarters.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-white/40 text-sm">
        Aún no hay datos para calcular el reparto. Importa ventas o registra movimientos.
      </div>
    );
  }

  const q = quarters[Math.min(idx, quarters.length - 1)];
  const profit = q.ingresos - q.costosDirectos - q.gastosOperativos - q.nomina;
  const reserva = profit > 0 ? (profit * reservaPct) / 100 : 0;
  const repartible = profit - reserva;

  const rows = [
    { label: "Ingresos del trimestre", value: q.ingresos, sign: "" as const, strong: true },
    { label: "− Costos directos (músicos)", value: -q.costosDirectos, sign: "minus" as const },
    { label: "− Gastos operativos", value: -q.gastosOperativos, sign: "minus" as const },
    { label: "− Nómina (sueldos)", value: -q.nomina, sign: "minus" as const },
    { label: `− Reserva (${reservaPct}%)`, value: -reserva, sign: "minus" as const },
  ];

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-coolvetica text-xl">Reparto trimestral</h2>
        <div className="flex items-center gap-3">
          <label className="text-white/40 text-xs flex items-center gap-1.5">
            Reserva
            <input
              type="number"
              value={reservaPct}
              onChange={(e) => setReservaPct(Math.max(0, Math.min(100, Number(e.target.value))))}
              className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm text-center"
            />
            %
          </label>
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lgb-red"
          >
            {quarters.map((qq, i) => (
              <option key={qq.key} value={i} className="bg-lgb-dark">{qq.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cascada */}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span className={`text-sm ${r.strong ? "text-white" : "text-white/60"}`}>{r.label}</span>
            <span className={`text-sm tabular-nums ${r.sign === "minus" ? "text-white/50" : "text-white font-medium"}`}>
              {money(r.value)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3">
          <span className="text-sm font-medium">= Utilidad repartible</span>
          <span className={`font-coolvetica text-2xl ${repartible >= 0 ? "text-green-300" : "text-red-400"}`}>
            {money(repartible)}
          </span>
        </div>
      </div>

      {/* Reparto a socios */}
      <div className="mt-5 pt-4 border-t border-white/10">
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Le toca a cada socio</p>
        {socios.length === 0 ? (
          <p className="text-white/40 text-sm">No hay socios configurados en el equipo.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {socios.map((s) => (
              <div key={s.id} className="rounded-xl border border-lgb-red/20 bg-lgb-red/5 p-4">
                <p className="text-sm text-white/60">{s.nombre} · {s.participacion_pct}%</p>
                <p className="font-coolvetica text-2xl mt-1">
                  {money(repartible > 0 ? (repartible * s.participacion_pct) / 100 : 0)}
                </p>
              </div>
            ))}
          </div>
        )}
        {profit <= 0 && (
          <p className="text-amber-300/80 text-xs mt-3">
            ⚠️ Este trimestre no hubo utilidad para repartir. Los sueldos base ya se cubrieron en la nómina; lo demás se cubre con la reserva.
          </p>
        )}
      </div>
    </div>
  );
}
