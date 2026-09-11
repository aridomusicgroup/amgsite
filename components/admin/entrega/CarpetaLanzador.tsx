"use client";
import { useEffect, useState } from "react";
import { FolderPen, Loader2, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "@/lib/toast";
import { EVENTO_CARPETA, type PedidoCarpeta } from "@/lib/entrega-cliente";

/**
 * "¿Renombrar también la carpeta de REAPER?"
 *
 * Sale después de renombrar un proyecto (desde Producción, Ventas o Pedidos) o
 * un tema de EP que ya tiene carpeta en la computadora del estudio. Montado una
 * vez en el menú, como el cuadro de entrega.
 *
 * Contestar cualquiera de las dos es seguro: la carpeta ya quedó anclada a su
 * nombre de siempre, así que con "No" el script la sigue encontrando. "Sí" deja
 * el encargo y el script la mueve en su siguiente vuelta.
 */
export function CarpetaLanzador() {
  const [c, setC] = useState<PedidoCarpeta | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const alPedir = (e: Event) => setC((e as CustomEvent<PedidoCarpeta>).detail);
    window.addEventListener(EVENTO_CARPETA, alPedir);
    return () => window.removeEventListener(EVENTO_CARPETA, alPedir);
  }, []);

  if (!c) return null;

  const renombrar = async () => {
    setEnviando(true);
    try {
      const r = await fetch("/api/admin/reaper-carpeta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabla: c.tabla, id: c.id, nueva: c.nueva }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo pedir");
      toast("📁 Se renombra en el estudio en menos de 2 min");
      setC(null);
    } catch (e) {
      toast(`⚠️ ${e instanceof Error ? e.message : "No se pudo pedir"}`);
    } finally {
      setEnviando(false);
    }
  };

  const chip = "font-mono text-[12px] px-2 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-white/85 truncate max-w-[45%]";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !enviando && setC(null)}>
      <div className="w-full max-w-md rounded-2xl bg-lgb-dark border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-3">
          <span className="w-9 h-9 rounded-xl bg-lgb-red/15 text-lgb-red flex items-center justify-center shrink-0"><FolderPen size={17} /></span>
          <div className="min-w-0">
            <p className="font-coolvetica text-lg leading-tight">
              ¿Renombrar también la carpeta de REAPER?
            </p>
            <p className="text-white/40 text-xs mt-0.5">{c.tabla === "proyecto_tareas" ? "La del tema, dentro del disco" : "La del proyecto, en la computadora del estudio"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 my-4">
          <span className={chip} title={c.actual}>{c.actual}</span>
          <ArrowRight size={14} className="text-white/30 shrink-0" />
          <span className={`${chip} border-lgb-red/30`} title={c.nueva}>{c.nueva}</span>
        </div>

        {c.sinMigracion ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-3 mb-4">
            <AlertTriangle size={15} className="text-amber-300 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-100/85 leading-relaxed">
              Falta correr <b>supabase-reaper-carpeta.sql</b>: sin eso el script ya no encuentra la carpeta
              «{c.actual}». Córrelo y vuelve a guardar el nombre para que te lo pregunte bien.
            </p>
          </div>
        ) : (
          <p className="text-xs text-white/50 leading-relaxed mb-4">
            <b className="text-white/75">Sí:</b> la computadora del estudio la renombra en su siguiente vuelta (menos
            de 2 min). Si REAPER la tiene abierta, espera a que la cierres.{" "}
            <b className="text-white/75">No:</b> se queda como está y el panel la sigue encontrando igual.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          {c.sinMigracion ? (
            <button onClick={() => setC(null)} className="px-4 py-2 rounded-xl text-sm bg-white/10 hover:bg-white/15 cursor-pointer">Entendido</button>
          ) : (
            <>
              <button onClick={() => setC(null)} disabled={enviando} className="px-4 py-2 rounded-xl text-sm text-white/60 hover:text-white cursor-pointer disabled:opacity-40">
                No, dejarla
              </button>
              <button onClick={renombrar} disabled={enviando}
                className="flex items-center gap-2 bg-lgb-red hover:bg-lgb-red/85 text-white px-4 py-2 rounded-xl text-sm cursor-pointer disabled:opacity-40">
                {enviando && <Loader2 size={14} className="animate-spin" />}
                Sí, renombrarla
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
