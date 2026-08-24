"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";

const EMPTY = { nombre: "", categoria: "", proveedor: "", monto_estimado: "", dia_mes: "5", notas: "" };

export function NuevoGastoRecurrenteForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/gastos-recurrentes", {
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

  const inp = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";
  const lbl = "block text-xs text-white/50 mb-1";

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-white/15 transition-all mb-4">
        <Plus size={15} /> Nuevo pago recurrente
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-4">
      <datalist id="categorias-recurrentes">
        <option value="Renta Estudio" /><option value="Renta Notion" /><option value="Servicios" />
      </datalist>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-coolvetica text-lg">Nuevo pago recurrente</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-white/40 hover:text-white"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="col-span-2 sm:col-span-3">
          <label className={lbl}>Nombre *</label>
          <input value={f.nombre} onChange={set("nombre")} required placeholder="Renta del estudio" className={inp} />
        </div>
        <div>
          <label className={lbl}>Categoría</label>
          <input list="categorias-recurrentes" value={f.categoria} onChange={set("categoria")} placeholder="Renta Estudio" className={inp} />
        </div>
        <div>
          <label className={lbl}>Proveedor</label>
          <input value={f.proveedor} onChange={set("proveedor")} placeholder="Casero / plataforma" className={inp} />
        </div>
        <div>
          <label className={lbl}>Monto estimado</label>
          <input type="number" step="any" value={f.monto_estimado} onChange={set("monto_estimado")} placeholder="3500" className={inp} />
        </div>
        <div>
          <label className={lbl}>Día del mes *</label>
          <input type="number" min={1} max={31} value={f.dia_mes} onChange={set("dia_mes")} required className={inp} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className={lbl}>Notas</label>
          <input value={f.notas} onChange={set("notas")} placeholder="Opcional" className={inp} />
        </div>
      </div>
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      <button type="submit" disabled={saving} className="flex items-center gap-2 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50 mt-4">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
