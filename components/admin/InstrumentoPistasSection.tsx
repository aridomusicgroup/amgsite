"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, X, ArrowRight, Check } from "lucide-react";
import { toast } from "@/lib/toast";

type Fila = { instrumento: string; pista: string };

/**
 * De qué instrumento a qué pista de REAPER.
 *
 * Lo usa el script local para decidir dónde meter la grabación que manda un
 * músico a distancia. Lo que no tenga equivalencia entra en una pista nueva al
 * final del proyecto — a propósito: adivinar por parecido metería el audio en
 * la pista equivocada sin avisar, y "Bass" contra "BAJO/TOLO" se confunden.
 *
 * Las sugerencias son nombres de pista que EXISTEN en tus proyectos (salen del
 * inventario que escanea reaper-sync), no los de la plantilla: los proyectos se
 * desvían de ella con el tiempo.
 */
export function InstrumentoPistasSection() {
  const [mapa, setMapa] = useState<Fila[] | null>(null);
  const [pistasVistas, setPistasVistas] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [nuevo, setNuevo] = useState({ instrumento: "", pista: "" });

  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";

  const cargar = async () => {
    try {
      const r = await fetch("/api/admin/instrumento-pistas", { cache: "no-store" });
      if (!r.ok) { setMapa([]); return; }
      const d = await r.json();
      setMapa(d.mapa ?? []);
      setPistasVistas(d.pistasVistas ?? []);
    } catch { setMapa([]); }
  };
  useEffect(() => { cargar(); }, []);

  const guardar = async (instrumento: string, pista: string) => {
    if (!instrumento.trim() || !pista.trim()) { toast("⚠️ Pon el instrumento y la pista"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/instrumento-pistas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumento, pista }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast(d.error || "No se pudo guardar"); return; }
      setNuevo({ instrumento: "", pista: "" });
      await cargar();
      toast("✓ Guardado");
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  const quitar = async (instrumento: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/instrumento-pistas?instrumento=${encodeURIComponent(instrumento)}`, { method: "DELETE" });
      if (r.ok) { await cargar(); toast("✓ Quitado — ese instrumento cae en pista nueva"); }
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <h2 className="font-coolvetica text-lg">Instrumento → pista de REAPER</h2>
      <p className="text-white/40 text-xs mt-0.5 mb-3">
        Dónde entra la grabación que manda un músico a distancia. Lo que no esté aquí llega en una
        <b className="text-white/60"> pista nueva al final</b> del proyecto, con su nombre — nunca se adivina.
      </p>

      <datalist id="pistas-vistas">
        {pistasVistas.map((p) => <option key={p} value={p} />)}
      </datalist>

      {mapa === null ? (
        <p className="text-white/30 text-xs flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Cargando…</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {mapa.map((f) => (
            <li key={f.instrumento} className="flex items-center gap-2 bg-white/[0.02] border border-white/8 rounded-lg px-3 py-2">
              <span className="text-sm w-32 shrink-0 truncate">{f.instrumento}</span>
              <ArrowRight size={12} className="text-white/25 shrink-0" />
              <span className="text-sm text-lgb-red flex-1 min-w-0 truncate">{f.pista}</span>
              <button onClick={() => quitar(f.instrumento)} disabled={busy}
                className="text-white/25 hover:text-red-300 shrink-0 cursor-pointer disabled:opacity-40"><X size={14} /></button>
            </li>
          ))}
          {mapa.length === 0 && <li className="text-white/30 text-xs">Sin equivalencias. Todo cae en pista nueva.</li>}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
        <input value={nuevo.instrumento} onChange={(e) => setNuevo((s) => ({ ...s, instrumento: e.target.value }))}
          placeholder="Instrumento (ej. Charchetas)" className={`${inp} w-44`} />
        <ArrowRight size={13} className="text-white/25" />
        <input value={nuevo.pista} onChange={(e) => setNuevo((s) => ({ ...s, pista: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") guardar(nuevo.instrumento, nuevo.pista); }}
          list="pistas-vistas" placeholder="Pista destino" className={`${inp} flex-1 min-w-[150px]`} />
        <button onClick={() => guardar(nuevo.instrumento, nuevo.pista)} disabled={busy}
          className="flex items-center gap-1 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Guardar
        </button>
      </div>
      <p className="text-white/25 text-[10px] mt-1.5 flex items-start gap-1">
        <Check size={11} className="mt-0.5 shrink-0" />
        El campo de pista te sugiere nombres que ya existen en tus proyectos. Si el destino es una carpeta
        (REQUINTO, BAJO/TOLO), la pista nueva entra <b className="text-white/40">dentro</b> de ella.
      </p>
    </div>
  );
}
