"use client";
import { useState } from "react";
import { DownloadCloud, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface Summary {
  contactos: number;
  ventas: number;
  egresos: number;
  inventario: number;
  errores: string[];
}

export function ImportPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!confirm("¿Importar el histórico del sheet a la base de datos? Es seguro: no borra nada y se puede repetir.")) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/admin/import-sheet", { method: "POST" });
      const d = await r.json();
      if (!r.ok) setError(d.error || "No se pudo importar.");
      else setResult(d.summary);
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  const cards = result
    ? [
        { label: "Clientes nuevos", value: result.contactos },
        { label: "Ventas", value: result.ventas },
        { label: "Egresos", value: result.egresos },
        { label: "Beats en inventario", value: result.inventario },
      ]
    : [];

  return (
    <div className="max-w-2xl">
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
        <p className="text-white/60 text-sm mb-4 leading-relaxed">
          Lee las 4 pestañas del sheet y las vuelca al ERP, uniendo clientes repetidos por nombre.
          Puedes correrlo las veces que quieras: actualiza lo existente sin duplicar.
        </p>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
          {loading ? "Importando…" : "Importar histórico del sheet"}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-3">
            <CheckCircle2 size={18} /> Importación completada
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <p className="text-2xl font-coolvetica">{c.value}</p>
                <p className="text-white/40 text-xs mt-1">{c.label}</p>
              </div>
            ))}
          </div>
          {result.errores.length > 0 && (
            <div className="mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-300">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium mb-1">Avisos:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {result.errores.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
