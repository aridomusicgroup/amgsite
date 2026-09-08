"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ScrollText, Check, Loader2, ChevronDown, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Venta } from "@/lib/erp-data";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const dias = (f: string) => Math.floor((Date.now() - new Date(f).getTime()) / 86400000);

/** Arranca en $2,000: abajo de eso son licencias de catálogo, cobro instantáneo. */
const UMBRALES = [2000, 1000, 0];

/**
 * Las ventas que el panel da por cobradas sin tener un solo pago registrado.
 *
 * `getVentas()` trata una venta sin renglones en `pagos` como cobrada al 100%
 * (la regla vive en `erp-data.ts`, junto al cálculo del saldo). Para una
 * licencia de BeatStars eso es cierto —se paga en el momento— pero hay 28
 * trabajos de estudio de $7,000 a $12,000 en la misma bolsa, y ahí la
 * suposición ya no es obvia.
 *
 * Mientras eso no se resuelva, el "por cobrar" del panel es una creencia. Y no
 * se le puede mandar un recordatorio de pago a alguien que ya pagó: es el peor
 * error posible con un cliente recurrente. Por eso esta pantalla va ANTES de
 * cualquier cobranza.
 *
 * No inventa lógica de pagos: escribe por `POST /api/admin/pagos`, que ya
 * etiqueta anticipo/abono/finiquito, recalcula fidelidad y deja bitácora.
 */
export function ConciliarVentas({ ventas }: { ventas: Venta[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [umbral, setUmbral] = useState(UMBRALES[0]);
  const [canal, setCanal] = useState("todos");
  const [busy, setBusy] = useState<string | null>(null);
  const [hechas, setHechas] = useState<Set<string>>(new Set());

  const sinPagos = useMemo(
    () => ventas.filter((v) => !v.tienePagos).sort((a, b) => b.total_mxn - a.total_mxn),
    [ventas],
  );

  const canales = useMemo(
    () => [...new Set(sinPagos.map((v) => v.canal || "(sin canal)"))].sort(),
    [sinPagos],
  );

  const lista = sinPagos.filter(
    (v) => v.total_mxn >= umbral && (canal === "todos" || (v.canal || "(sin canal)") === canal) && !hechas.has(v.id),
  );
  const montoLista = lista.reduce((a, v) => a + v.total_mxn, 0);

  // Trabajo de estudio: es donde la suposición de "ya se pagó" puede estar mal.
  const deEstudio = sinPagos.filter((v) => v.canal !== "beatstars" && v.total_mxn >= 2000 && !hechas.has(v.id));

  if (!sinPagos.length) return null;

  const liquidar = async (v: Venta) => {
    if (!confirm(`¿Marcar ${v.folio} como pagada completa por ${peso(v.total_mxn)}?\n\nEscribe un pago por el total con la fecha de la venta. Si en realidad entró sólo una parte, usa "Registrar parcial".`)) return;
    setBusy(v.id);
    try {
      const r = await fetch("/api/admin/pagos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venta_id: v.id, monto_mxn: v.total_mxn, fecha: v.fecha,
          tipo: "completo", medio_pago: v.medio_pago || null,
          notas: "Conciliación: se confirmó que se cobró completa",
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo"}`); return; }
      setHechas((s) => new Set(s).add(v.id));
      toast(`✓ ${v.folio} queda liquidada`);
      router.refresh();
    } finally { setBusy(null); }
  };

  const parcial = async (v: Venta) => {
    const txt = prompt(`¿Cuánto se cobró de ${v.folio} (total ${peso(v.total_mxn)})?\n\nEl resto queda como saldo por cobrar.`);
    if (txt === null) return;
    const monto = Number(String(txt).replace(/[^0-9.]/g, ""));
    if (!(monto > 0)) { toast("⚠️ Monto inválido"); return; }
    if (monto > v.total_mxn + 0.5) { toast("⚠️ Es más que el total de la venta"); return; }
    setBusy(v.id);
    try {
      const r = await fetch("/api/admin/pagos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venta_id: v.id, monto_mxn: monto, fecha: v.fecha,
          medio_pago: v.medio_pago || null,
          notas: "Conciliación: lo que sí se había cobrado",
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo"}`); return; }
      setHechas((s) => new Set(s).add(v.id));
      toast(d.liquidada ? `✓ ${v.folio} queda liquidada` : `✓ ${v.folio} · saldo ${peso(d.saldo)}`);
      router.refresh();
    } finally { setBusy(null); }
  };

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] overflow-hidden">
      <button onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors cursor-pointer">
        <ScrollText size={16} className="text-amber-300 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/85">
            {sinPagos.length} ventas se dan por cobradas sin un solo pago registrado
          </p>
          <p className="text-[11px] text-amber-200/70 mt-0.5">
            {peso(sinPagos.reduce((a, v) => a + v.total_mxn, 0))} en total
            {deEstudio.length > 0 && <> · {deEstudio.length} son trabajo de estudio de más de $2,000</>}
          </p>
        </div>
        <ChevronDown size={16} className={`text-white/30 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-white/45 leading-relaxed border-l-2 border-amber-500/30 pl-2.5">
            Una venta sin pagos se cuenta como cobrada al 100%. En BeatStars eso es cierto —se
            paga en el momento—, pero un beat personalizado de $9,000 cobrado en dos partes,
            capturado sin sus pagos, se ve idéntico a uno ya liquidado. Mientras queden aquí,
            el <b className="text-white/70">Por cobrar</b> de arriba es una suposición.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <select value={umbral} onChange={(e) => setUmbral(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none">
              {UMBRALES.map((u) => (
                <option key={u} value={u} className="bg-lgb-dark">
                  {u === 0 ? "Todos los montos" : `Desde ${peso(u)}`}
                </option>
              ))}
            </select>
            <select value={canal} onChange={(e) => setCanal(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none">
              <option value="todos" className="bg-lgb-dark">Todos los canales</option>
              {canales.map((c) => <option key={c} value={c} className="bg-lgb-dark">{c}</option>)}
            </select>
            <span className="text-[11px] text-white/35">
              {lista.length} ventas · {peso(montoLista)}
            </span>
          </div>

          {lista.length === 0 ? (
            <p className="text-xs text-white/30 py-2">Nada con ese filtro.</p>
          ) : (
            <div className="space-y-1.5 max-h-[26rem] overflow-y-auto">
              {lista.map((v) => {
                const sospechosa = v.canal !== "beatstars" && v.total_mxn >= 2000;
                return (
                  <div key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                    {sospechosa && <AlertTriangle size={12} className="text-amber-300 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/80 truncate">
                        {v.folio} · {v.cliente || "sin cliente"}
                        <span className="text-white/35"> — {peso(v.total_mxn)}</span>
                      </p>
                      <p className="text-[11px] text-white/30 truncate">
                        {v.tipo || "—"} · {v.canal || "sin canal"} · hace {dias(v.fecha)} días
                      </p>
                    </div>
                    <button onClick={() => liquidar(v)} disabled={busy === v.id}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-green-500/15 text-green-300 hover:bg-green-500/25 disabled:opacity-40 shrink-0 cursor-pointer">
                      {busy === v.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Se pagó completa
                    </button>
                    <button onClick={() => parcial(v)} disabled={busy === v.id}
                      className="text-[11px] px-2 py-1 rounded-lg bg-white/8 text-white/60 hover:bg-white/15 disabled:opacity-40 shrink-0 cursor-pointer">
                      Registrar parcial
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
