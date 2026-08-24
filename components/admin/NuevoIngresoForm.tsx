"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";

const hoy = () => new Date().toISOString().slice(0, 10);
const EMPTY = { fecha: hoy(), fuente: "", concepto: "", monto_mxn: "", recurrente: false, nota: "" };

// Registra dinero SIN cliente (YouTube, streaming, payouts…). Va a Finanzas + reparto.
export function NuevoIngresoForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: k === "recurrente" ? e.target.checked : e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/ingresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "No se pudo guardar.");
      else { setF({ ...EMPTY }); setOpen(false); router.refresh(); }
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500";
  const lbl = "block text-xs text-white/50 mb-1";

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-green-500/15 text-green-300 px-4 py-2 rounded-full text-sm font-medium hover:bg-green-500/25 transition-all mb-4">
        <Plus size={15} /> Nuevo ingreso
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-4">
      <datalist id="fuentes-ingreso">
        <option value="YouTube" /><option value="Streaming (Spotify, etc.)" /><option value="BeatStars (payout)" />
        <option value="Sync / Licencia" /><option value="Distribución" /><option value="Otro" />
      </datalist>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-coolvetica text-lg">Nuevo ingreso <span className="text-white/40 text-sm font-sans">(sin cliente)</span></h3>
        <button type="button" onClick={() => setOpen(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Fecha *</label>
          <input type="date" value={f.fecha} onChange={set("fecha")} required className={inp} />
        </div>
        <div>
          <label className={lbl}>Fuente</label>
          <input list="fuentes-ingreso" value={f.fuente} onChange={set("fuente")} placeholder="YouTube" className={inp} />
        </div>
        <div>
          <label className={lbl}>Monto MXN *</label>
          <input type="number" step="any" value={f.monto_mxn} onChange={set("monto_mxn")} required placeholder="3500" className={inp} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className={lbl}>Concepto</label>
          <input value={f.concepto} onChange={set("concepto")} placeholder="Regalías de julio…" className={inp} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className={lbl}>Nota (opcional)</label>
          <input value={f.nota} onChange={set("nota")} placeholder="Ej. entró en USD ~$180" className={inp} />
        </div>
      </div>
      <label className="flex items-center gap-2 mt-3 text-sm text-white/60">
        <input type="checkbox" checked={f.recurrente} onChange={set("recurrente")} className="accent-green-500" />
        Es recurrente (llega cada mes)
      </label>
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      <button type="submit" disabled={saving} className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-green-700 transition-all disabled:opacity-50 mt-4">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        {saving ? "Guardando…" : "Guardar ingreso"}
      </button>
    </form>
  );
}
