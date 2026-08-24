"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export function DedupButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ gruposFusionados: number; contactosFusionados: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!confirm("¿Fusionar contactos duplicados por nombre? Es reversible (los duplicados se ocultan, no se borran).")) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/admin/dedup", { method: "POST" });
      const d = await r.json();
      if (!r.ok) setError(d.error || "No se pudo fusionar.");
      else { setResult(d.summary); router.refresh(); }
    } catch { setError("Error de conexión."); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <h2 className="font-coolvetica text-lg mb-1">Fusionar duplicados</h2>
      <p className="text-white/50 text-sm mb-4 leading-relaxed">
        Une al mismo cliente cuando aparece repetido por nombre (ej. uno por el sheet y otro por el email de BeatStars).
        Conserva al más completo y le pasa email, teléfono y ventas. Reversible.
      </p>
      <button onClick={run} disabled={loading}
        className="flex items-center gap-2 bg-white/10 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white/15 transition-all disabled:opacity-50">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
        {loading ? "Fusionando…" : "Fusionar duplicados"}
      </button>

      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {result && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-3"><CheckCircle2 size={16} /> Listo</div>
          <ul className="text-sm text-white/60 space-y-1">
            <li>👥 Clientes consolidados: <b className="text-white">{result.gruposFusionados}</b></li>
            <li>🔗 Fichas duplicadas fusionadas: <b className="text-white">{result.contactosFusionados}</b></li>
          </ul>
        </div>
      )}
    </div>
  );
}
