"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { money } from "@/components/admin/ui";
import { toast } from "@/lib/toast";
import { calcularBolsas, type AjustesBolsas, type MesFinanzas } from "@/lib/bolsas";

type Clave = "directos" | "impuestos" | "operacion" | "sueldosSocios" | "colchon" | "reparto";
const BOLSAS: { k: Clave; nombre: string; color: string }[] = [
  { k: "directos", nombre: "Directos", color: "bg-zinc-400" },
  { k: "impuestos", nombre: "Impuestos", color: "bg-amber-400" },
  { k: "operacion", nombre: "Operación", color: "bg-sky-400" },
  { k: "sueldosSocios", nombre: "Sueldos de socios", color: "bg-emerald-400" },
  { k: "colchon", nombre: "Colchón", color: "bg-violet-400" },
  { k: "reparto", nombre: "Reparto", color: "bg-lgb-red" },
];

const mesAnterior = (m: string) => {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mm - 2, 1)).toISOString().slice(0, 7);
};
const nombreMes = (m: string) => new Date(m + "-15T12:00:00").toLocaleDateString("es-MX", { month: "long" });
const fechaLarga = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long" });

/**
 * Cada cobro del mes repartido en las seis bolsas, y cuánto hay que mover a
 * impuestos y al colchón. El dinero no se mueve solo: esto dice cuánto.
 */
export function BolsasMes({ meses, ajustes, mesActual }: { meses: MesFinanzas[]; ajustes: AjustesBolsas; mesActual: string }) {
  const router = useRouter();
  const [sel, setSel] = useState(mesActual);
  const [editando, setEditando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(() => ({
    impuestos_pct: String(ajustes.impuestosPct),
    colchon_pct: String(ajustes.colchonPct),
    colchon_meta: String(ajustes.colchonMeta),
    colchon_inicial: String(ajustes.colchonInicial),
    inicio: ajustes.inicio,
    escalones: ajustes.escalones.map((e) => ({ desde: String(e.desde), semanal: String(e.semanal) })),
  }));

  const vacio = (mes: string): MesFinanzas => ({ mes, cobrado: 0, directos: 0, operacion: 0, sueldosSocios: 0 });
  const opciones = [mesAnterior(mesActual), mesActual];
  const completos = [...meses, ...opciones.filter((m) => !meses.some((x) => x.mes === m)).map(vacio)];
  const bolsas = calcularBolsas(completos, ajustes);
  const b = bolsas.find((x) => x.mes === sel) ?? bolsas[bolsas.length - 1];
  const saldo = [...bolsas].reverse().find((x) => x.real && x.mes <= mesActual)?.colchonSaldo ?? ajustes.colchonInicial;
  const avance = ajustes.colchonMeta > 0 ? Math.max(0, Math.min(1, saldo / ajustes.colchonMeta)) : 0;

  const guardar = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/finanzas-ajustes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, escalones: f.escalones.map((e) => ({ desde: Number(e.desde), semanal: Number(e.semanal) })) }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "No se pudieron guardar los ajustes"); return; }
      toast("✓ Ajustes guardados");
      setEditando(false);
      router.refresh();
    } catch {
      toast("Error de red");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lgb-red";

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="font-coolvetica text-xl">Bolsas del mes</h2>
          <p className="text-white/40 text-xs mt-0.5">Cada peso cobrado, en orden: directos, impuestos, operación, sueldos, colchón y reparto.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {opciones.map((m) => (
            <button
              key={m}
              onClick={() => setSel(m)}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize ${sel === m ? "bg-white/15 text-white" : "text-white/50 hover:text-white"}`}
            >
              {nombreMes(m)}
            </button>
          ))}
          <button
            onClick={() => setEditando((v) => !v)}
            className={`p-1.5 rounded-lg ${editando ? "bg-white/15 text-white" : "text-white/40 hover:text-white"}`}
            title="Ajustes de las bolsas"
            aria-label="Ajustes de las bolsas"
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm text-white/60">Cobrado en <span className="capitalize">{nombreMes(b.mes)}</span></span>
        <span className="font-coolvetica text-2xl tabular-nums">{money(b.cobrado)}</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-white/5 mb-4" aria-hidden="true">
        {b.cobrado > 0 && BOLSAS.map((x) => (
          <span key={x.k} className={x.color} style={{ width: `${(b[x.k] / b.cobrado) * 100}%` }} />
        ))}
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2">
        {BOLSAS.map((x) => (
          <div key={x.k} className="flex items-center justify-between gap-2 text-sm">
            <dt className="flex items-center gap-2 text-white/60 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${x.color}`} />
              <span className="truncate">{x.nombre}</span>
            </dt>
            <dd className="tabular-nums">{money(b[x.k])}</dd>
          </div>
        ))}
      </dl>

      {b.real ? (
        <p className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/[0.06] px-4 py-2.5 text-sm text-violet-100/90">
          De lo cobrado en <span className="capitalize">{nombreMes(b.mes)}</span>, aparta <b>{money(b.impuestos)}</b> para impuestos y <b>{money(b.colchon)}</b> al colchón.
        </p>
      ) : (
        <p className="mt-4 text-white/40 text-xs">Las bolsas se apartan desde el {fechaLarga(ajustes.inicio)}; este mes es solo de referencia.</p>
      )}
      {b.faltante > 0.5 && (
        <p className="mt-2 text-amber-300/80 text-xs">
          No alcanzó: faltan {money(b.faltante)} para cubrir directos, impuestos, operación y sueldos. Eso sale del colchón.
        </p>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-white/50">Colchón</span>
          <span className={`tabular-nums ${saldo < 0 ? "text-red-400" : "text-white/70"}`}>
            {money(saldo)} de {money(ajustes.colchonMeta)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-violet-400 rounded-full" style={{ width: `${avance * 100}%` }} />
        </div>
      </div>

      {editando && (
        <div className="mt-5 pt-4 border-t border-white/10">
          {!ajustes.guardado && (
            <p className="text-amber-300/80 text-xs mb-3">
              Todavía no se corre supabase-bolsas.sql: se usan estos valores por defecto y no se pueden guardar.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {([
              ["impuestos_pct", "Impuestos (%)"],
              ["colchon_pct", "Colchón (%)"],
              ["colchon_meta", "Meta del colchón"],
              ["colchon_inicial", "Fondo al iniciar"],
            ] as const).map(([k, label]) => (
              <label key={k} className="block">
                <span className="block text-xs text-white/50 mb-1">{label}</span>
                <input type="number" min={0} value={f[k]} onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))} className={input} />
              </label>
            ))}
            <label className="block">
              <span className="block text-xs text-white/50 mb-1">Se aparta desde</span>
              <input type="date" value={f.inicio} onChange={(e) => setF((s) => ({ ...s, inicio: e.target.value }))} className={input} />
            </label>
          </div>
          <p className="text-xs text-white/50 mt-4 mb-2">Sueldo semanal de cada socio según el promedio cobrado de 3 meses</p>
          <div className="space-y-2">
            {f.escalones.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-white/60">
                <span className="shrink-0">Desde</span>
                <input type="number" min={0} value={e.desde} className={`${input} w-28`}
                  onChange={(ev) => setF((s) => ({ ...s, escalones: s.escalones.map((x, j) => (j === i ? { ...x, desde: ev.target.value } : x)) }))} />
                <span className="shrink-0">al mes →</span>
                <input type="number" min={0} value={e.semanal} className={`${input} w-24`}
                  onChange={(ev) => setF((s) => ({ ...s, escalones: s.escalones.map((x, j) => (j === i ? { ...x, semanal: ev.target.value } : x)) }))} />
                <span className="shrink-0">por semana</span>
              </div>
            ))}
          </div>
          <button
            onClick={guardar}
            disabled={busy || !ajustes.guardado}
            className="mt-4 flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Guardar ajustes
          </button>
        </div>
      )}
    </div>
  );
}
