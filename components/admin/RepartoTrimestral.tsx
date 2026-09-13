"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { money } from "@/components/admin/ui";
import { toast } from "@/lib/toast";
import { calcularBolsas, bolsasDelTrimestre, trimestreDeMes, type AjustesBolsas, type MesFinanzas } from "@/lib/bolsas";
import type { RepartoRow, SocioMin } from "@/lib/erp-data";

const etiqueta = (k: string) => { const [y, t] = k.split("-"); return `${t} ${y}`; };
const fecha = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });

/**
 * El reparto del trimestre con las seis bolsas: lo que queda después de
 * directos, impuestos, operación, sueldos y colchón, menos lo que ya se
 * repartió a cuenta. Si se repartió de más, lo dice en vez de esconderlo.
 */
export function RepartoTrimestral({ meses, ajustes, repartos, repartidoPorTrimestre, socios }: {
  meses: MesFinanzas[];
  ajustes: AjustesBolsas;
  repartos: RepartoRow[];
  repartidoPorTrimestre: Record<string, number>;
  socios: SocioMin[];
}) {
  const router = useRouter();
  const bolsas = calcularBolsas(meses, ajustes);
  const trimestres = [...new Set(bolsas.map((b) => trimestreDeMes(b.mes)))].sort().reverse();
  const [sel, setSel] = useState(trimestres[0] ?? "");
  const [busy, setBusy] = useState(false);

  if (trimestres.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-white/40 text-sm">
        Aún no hay datos para calcular el reparto. Importa ventas o registra movimientos.
      </div>
    );
  }

  const t = bolsasDelTrimestre(bolsas, sel);
  const repartido = repartidoPorTrimestre[sel] ?? 0;
  const falta = t.reparto - repartido;
  const hechos = repartos.filter((r) => r.periodo === sel);

  const filas = [
    { label: "Cobrado del trimestre", value: t.cobrado, fuerte: true },
    { label: "− Directos (músicos y comisiones)", value: -t.directos },
    { label: `− Impuestos (${ajustes.impuestosPct}%)`, value: -t.impuestos },
    { label: "− Operación (renta, servicios, colaboradores)", value: -t.operacion },
    { label: "− Sueldos de socios", value: -t.sueldosSocios },
    { label: `− Colchón (${ajustes.colchonPct}%)`, value: -t.colchon },
  ];

  const cerrar = async () => {
    const montos = socios.map((s) => ({ socio_id: s.id, participacion_pct: s.participacion_pct, monto: (falta * s.participacion_pct) / 100 }));
    const detalle = socios.map((s, i) => `${s.nombre}: ${money(montos[i].monto)}`).join("\n");
    if (!confirm(`¿Registrar el reparto de ${etiqueta(sel)} por ${money(falta)} como pagado hoy?\n\n${detalle}`)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/repartos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodo: sel,
          socios: montos,
          ingresos: t.cobrado,
          costos_directos: t.directos,
          gastos_operativos: t.operacion,
          nomina: t.sueldosSocios,
          reserva_pct: ajustes.colchonPct,
          reserva_monto: t.colchon,
          notas: `Cierre con bolsas: impuestos ${money(t.impuestos)}, colchón ${money(t.colchon)}.`,
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "No se pudo registrar el reparto"); return; }
      toast(`✓ Reparto de ${etiqueta(sel)} registrado`);
      router.refresh();
    } catch {
      toast("Error de red");
    } finally {
      setBusy(false);
    }
  };

  const borrar = async (r: RepartoRow) => {
    if (!confirm(`¿Borrar el reparto de ${money(r.total)}? Solo si se registró por error.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/repartos?id=${encodeURIComponent(r.id)}`, { method: "DELETE" });
      if (res.ok) { toast("Reparto borrado"); router.refresh(); } else toast("No se pudo borrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="font-coolvetica text-xl">Reparto trimestral</h2>
          <p className="text-white/40 text-xs mt-0.5">Lo que sobra después de las bolsas, menos lo que ya se repartió.</p>
        </div>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lgb-red"
        >
          {trimestres.map((k) => (
            <option key={k} value={k} className="bg-lgb-dark">{etiqueta(k)}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        {filas.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-white/5">
            <span className={`text-sm ${r.fuerte ? "text-white" : "text-white/60"}`}>{r.label}</span>
            <span className={`text-sm tabular-nums ${r.fuerte ? "text-white font-medium" : "text-white/50"}`}>{money(r.value)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-medium">= Disponible para repartir</span>
          <span className="font-coolvetica text-xl tabular-nums">{money(t.reparto)}</span>
        </div>
        {repartido > 0 && (
          <div className="flex items-center justify-between py-1.5 border-t border-white/5">
            <span className="text-sm text-white/60">− Ya repartido en el trimestre</span>
            <span className="text-sm tabular-nums text-white/50">{money(-repartido)}</span>
          </div>
        )}
      </div>
      {t.faltante > 0.5 && (
        <p className="text-amber-300/80 text-xs mt-2">
          En este trimestre faltaron {money(t.faltante)} para cubrir directos, impuestos, operación y sueldos; eso sale del colchón.
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-white/10">
        {falta >= 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <p className="text-white/40 text-xs uppercase tracking-wider">Falta por repartir</p>
              <p className="font-coolvetica text-2xl text-green-300 tabular-nums">{money(falta)}</p>
            </div>
            {socios.length === 0 ? (
              <p className="text-white/40 text-sm">No hay socios configurados en el equipo.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {socios.map((s) => (
                  <div key={s.id} className="rounded-xl border border-lgb-red/20 bg-lgb-red/5 p-4">
                    <p className="text-sm text-white/60">{s.nombre} · {s.participacion_pct}%</p>
                    <p className="font-coolvetica text-2xl mt-1 tabular-nums">{money((falta * s.participacion_pct) / 100)}</p>
                  </div>
                ))}
              </div>
            )}
            {falta > 1 && socios.length > 0 && (
              <button
                onClick={cerrar}
                disabled={busy}
                className="mt-3 flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Cerrar reparto del trimestre
              </button>
            )}
          </>
        ) : (
          <p className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200/90">
            <b>Se adelantó {money(-falta)}.</b> En {etiqueta(sel)} se repartió más de lo que dejan las bolsas; esa diferencia sale del colchón y conviene reponerla antes del siguiente reparto.
          </p>
        )}

        {hechos.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {hechos.map((r) => (
              <li key={r.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">Repartido {r.fecha ? `el ${fecha(r.fecha)}` : ""}</p>
                  {r.notas && <p className="text-white/40 text-xs truncate">{r.notas}</p>}
                </div>
                <span className="text-sm font-medium tabular-nums">{money(r.total)}</span>
                <button onClick={() => borrar(r)} disabled={busy} className="text-white/30 hover:text-red-400 disabled:opacity-40" title="Borrar">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
