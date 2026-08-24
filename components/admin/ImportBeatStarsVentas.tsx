"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, AlertTriangle, Loader2, Eye, DollarSign } from "lucide-react";

interface Resumen {
  leidas: number; ignoradas: number; yaImportadas: number; aCrear: number;
  desde: string | null; hasta: string | null;
  usdPagado: number; usdNeto: number; usdComision: number;
  totalMxn: number; tipoCambio: number;
  contactosExistentes: number; contactosNuevos: number; beatsDistintos: number;
  porTipo: Record<string, number>;
  muestra: { fecha: string | null; cliente: string; beat: string; tipo: string; usd: number; mxn: number }[];
}

const peso = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Importa el histórico de VENTAS de BeatStars.
 *
 * Dos pasos a propósito: primero enseña exactamente qué se va a crear y hasta
 * entonces aparece el botón de guardar. Son ventas —dinero— y meter 169 de
 * golpe no se deshace con un clic.
 */
export function ImportBeatStarsVentas() {
  const router = useRouter();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tipoCambio, setTipoCambio] = useState("17.50");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [guardado, setGuardado] = useState<{ creadas: number; contactosCreados: number; clientesActualizados: number } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const llamar = async (contenido: string, confirmar: boolean) => {
    setCargando(true); setError(null);
    try {
      const r = await fetch("/api/admin/import-beatstars-ventas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: contenido, tipoCambio: Number(tipoCambio), confirmar }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "No se pudo procesar."); return; }
      setResumen(d.resumen);
      if (confirmar) { setGuardado(d); router.refresh(); }
    } catch { setError("No se pudo leer el archivo."); }
    finally { setCargando(false); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setResumen(null); setGuardado(null);
    const texto = await file.text();
    setCsv(texto);
    await llamar(texto, false);
    e.target.value = "";
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <h2 className="font-coolvetica text-lg mb-1">Ventas históricas de BeatStars (CSV)</h2>
      <p className="text-white/50 text-sm mb-4 leading-relaxed">
        Exporta <b>Transactions</b> desde BeatStars (Studio → Sales) y súbelo aquí. Crea las ventas con su
        fecha, cliente y monto reales. <b>Primero te enseña qué haría</b> y hasta entonces te deja guardar.
        No duplica: si vuelves a subir el mismo archivo, no crea nada.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label className="block text-[10px] text-white/40 uppercase tracking-wider mb-1">Tipo de cambio (USD → MXN)</label>
          <div className="flex items-center gap-1.5">
            <DollarSign size={14} className="text-white/30" />
            <input value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value)} inputMode="decimal"
              className="w-24 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lgb-red" />
          </div>
        </div>
        <label className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-5 py-2 rounded-full text-sm font-medium cursor-pointer">
          {cargando && !resumen ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {cargando && !resumen ? "Leyendo…" : "Subir CSV de Transactions"}
          <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={cargando} className="hidden" />
        </label>
      </div>
      {fileName && <p className="text-white/30 text-xs -mt-2 mb-3">{fileName}</p>}
      <p className="text-white/25 text-[11px] mb-4">
        Un solo tipo de cambio para todo el histórico (2023–2026). Se guarda en cada venta, así que queda auditable.
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {resumen && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            {guardado
              ? <><CheckCircle2 size={16} className="text-green-400" /><span className="text-sm text-green-400">Importado</span></>
              : <><Eye size={16} className="text-amber-300" /><span className="text-sm text-amber-300">Vista previa — todavía no se guardó nada</span></>}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Dato label="Ventas a crear" valor={String(resumen.aCrear)} fuerte />
            <Dato label="Ya importadas" valor={String(resumen.yaImportadas)} />
            <Dato label="Clientes nuevos" valor={String(resumen.contactosNuevos)} />
            <Dato label="Beats distintos" valor={String(resumen.beatsDistintos)} />
          </div>

          <ul className="text-sm text-white/60 space-y-1 mb-4">
            <li>📅 Periodo: <b className="text-white">{resumen.desde} → {resumen.hasta}</b></li>
            <li>💵 Te quedó (neto): <b className="text-white">{peso(resumen.usdNeto)} USD</b> · pagaron {peso(resumen.usdPagado)} · comisión BeatStars {peso(resumen.usdComision)}</li>
            <li>💰 En pesos a {resumen.tipoCambio}: <b className="text-white">{peso(resumen.totalMxn)} MXN</b></li>
            <li>🏷️ {Object.entries(resumen.porTipo).map(([k, v]) => `${v} ${k}`).join(" · ")}</li>
            {resumen.ignoradas > 0 && <li className="text-amber-300/80">⚠️ {resumen.ignoradas} renglones ilegibles, se saltaron</li>}
          </ul>

          {resumen.muestra.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-[11px]">
                <thead><tr className="text-white/35 text-left">
                  <th className="py-1 pr-3 font-normal">Fecha</th><th className="py-1 pr-3 font-normal">Cliente</th>
                  <th className="py-1 pr-3 font-normal">Beat</th><th className="py-1 pr-3 font-normal">Tipo</th>
                  <th className="py-1 text-right font-normal">MXN</th>
                </tr></thead>
                <tbody className="text-white/70">
                  {resumen.muestra.map((m, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-1 pr-3 whitespace-nowrap">{m.fecha}</td>
                      <td className="py-1 pr-3 truncate max-w-[9rem]">{m.cliente}</td>
                      <td className="py-1 pr-3 truncate max-w-[10rem]">{m.beat}</td>
                      <td className="py-1 pr-3 whitespace-nowrap">{m.tipo}</td>
                      <td className="py-1 text-right whitespace-nowrap">{peso(m.mxn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {guardado ? (
            <p className="text-sm text-white/60">
              ✅ <b className="text-white">{guardado.creadas}</b> ventas creadas ·{" "}
              <b className="text-white">{guardado.contactosCreados}</b> contactos nuevos ·{" "}
              <b className="text-white">{guardado.clientesActualizados}</b> clientes con su valor actualizado.
            </p>
          ) : resumen.aCrear > 0 ? (
            <button onClick={() => csv && llamar(csv, true)} disabled={cargando}
              className="flex items-center gap-2 bg-lgb-red hover:bg-red-700 text-white px-5 py-2.5 rounded-full text-sm font-medium disabled:opacity-50 cursor-pointer">
              {cargando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Guardar estas {resumen.aCrear} ventas
            </button>
          ) : (
            <p className="text-sm text-white/50">Nada nuevo que importar — este archivo ya está adentro.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Dato({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${fuerte ? "border-lgb-red/30 bg-lgb-red/[0.07]" : "border-white/8 bg-white/[0.02]"}`}>
      <p className="text-xl font-coolvetica">{valor}</p>
      <p className="text-white/40 text-[11px] mt-0.5">{label}</p>
    </div>
  );
}
