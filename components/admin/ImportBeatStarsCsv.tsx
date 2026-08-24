"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

interface Summary { filas: number; nuevos: number; enriquecidos: number; sinEmail: number }

export function ImportBeatStarsCsv() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true); setError(null); setResult(null);
    try {
      const csv = await file.text();
      const r = await fetch("/api/admin/import-beatstars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "No se pudo importar el CSV.");
      else { setResult(d.summary); router.refresh(); }
    } catch { setError("No se pudo leer el archivo."); }
    finally { setLoading(false); e.target.value = ""; }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <h2 className="font-coolvetica text-lg mb-1">Compradores de BeatStars (CSV)</h2>
      <p className="text-white/50 text-sm mb-4 leading-relaxed">
        Exporta el reporte de <b>Customers</b> desde BeatStars y súbelo aquí. Trae a los compradores al
        CRM por su <b>email</b>, con nombre completo y ubicación. Completa nombres a medias
        (“Fernando” → “Fernando Chavira”) pero <b>nunca pisa</b> uno que ya esté bien.
        No crea ventas — el CSV de BeatStars no trae fechas ni montos por compra.
      </p>
      <label className="inline-flex items-center gap-2 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 transition-all cursor-pointer disabled:opacity-50">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        {loading ? "Procesando…" : "Subir CSV de BeatStars"}
        <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={loading} className="hidden" />
      </label>
      {fileName && !loading && <p className="text-white/30 text-xs mt-2">{fileName}</p>}

      {error && (
        <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}
      {result && (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-3"><CheckCircle2 size={16} /> CSV procesado</div>
          <ul className="text-sm text-white/60 space-y-1">
            <li>📄 Filas leídas: <b className="text-white">{result.filas}</b></li>
            <li>🆕 Compradores nuevos: <b className="text-white">{result.nuevos}</b></li>
            <li>✏️ Fichas enriquecidas: <b className="text-white">{result.enriquecidos}</b></li>
            <li>⚠️ Filas sin email válido: <b className="text-white">{result.sinEmail}</b></li>
          </ul>
        </div>
      )}
    </div>
  );
}
