"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface Summary {
  inventarioEnlazadoACatalogo: number;
  ventasEnlazadasAInventario: number;
  ventasBeatPersonalizado: number;
  inventarioSinCatalogo: number;
}

export function ReconciliarButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/admin/reconciliar", { method: "POST" });
      const d = await r.json();
      if (!r.ok) setError(d.error || "No se pudo reconciliar.");
      else { setResult(d.summary); router.refresh(); }
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <h2 className="font-coolvetica text-lg mb-1">Reconciliar beats</h2>
      <p className="text-white/50 text-sm mb-4 leading-relaxed">
        Cruza inventario ↔ catálogo ↔ ventas y enlaza lo que hace match por nombre. Cura, compara y rellena. Seguro y repetible.
      </p>
      <button onClick={run} disabled={loading}
        className="flex items-center gap-2 bg-white/10 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white/15 transition-all disabled:opacity-50">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
        {loading ? "Reconciliando…" : "Reconciliar ahora"}
      </button>

      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {result && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-3"><CheckCircle2 size={16} /> Reconciliado</div>
          <ul className="text-sm text-white/60 space-y-1">
            <li>🔗 Inventario enlazado al catálogo: <b className="text-white">{result.inventarioEnlazadoACatalogo}</b></li>
            <li>🔗 Ventas enlazadas a un beat: <b className="text-white">{result.ventasEnlazadasAInventario}</b></li>
            <li>🎨 Ventas de beat personalizado (sin catálogo, normal): <b className="text-white">{result.ventasBeatPersonalizado}</b></li>
            <li>📦 Inventario sin match en catálogo: <b className="text-white">{result.inventarioSinCatalogo}</b></li>
          </ul>
        </div>
      )}
    </div>
  );
}
