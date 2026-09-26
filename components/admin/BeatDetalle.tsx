"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ExternalLink, Music2, Star } from "lucide-react";
import { LICENCIAS } from "@/lib/beat-ficha";
import type { BeatDetalleAdmin } from "@/lib/beat-admin";
import { Pastilla } from "@/components/admin/beat-detalle/comun";
import { FichaTab } from "@/components/admin/beat-detalle/FichaTab";
import { TiendaTab } from "@/components/admin/beat-detalle/TiendaTab";
import { PortadaTab } from "@/components/admin/beat-detalle/PortadaTab";
import { EntregaTab } from "@/components/admin/beat-detalle/EntregaTab";
import { PromocionTab } from "@/components/admin/beat-detalle/PromocionTab";
import { VentasTab } from "@/components/admin/beat-detalle/VentasTab";

/**
 * Ficha de un beat: todo lo de su distribución en un lugar — datos, tienda y
 * precios, portada, audio y entrega, promoción y ventas.
 */
export function BeatDetalle({ d }: { d: BeatDetalleAdmin }) {
  const tabs = [
    { id: "ficha", label: "Ficha" },
    { id: "tienda", label: "Tienda y precios" },
    { id: "portada", label: "Portada" },
    { id: "entrega", label: "Audio y entrega" },
    { id: "promocion", label: "Promoción" },
    ...(d.ventas ? [{ id: "ventas", label: `Ventas${d.ventas.length ? ` (${d.ventas.length})` : ""}` }] : []),
  ];

  // La pestaña se puede pedir por URL (?tab=precios), igual que en Proyectos.
  const pedida = useSearchParams().get("tab");
  const [tab, setTab] = useState(() => (pedida && tabs.some((t) => t.id === pedida) ? pedida : "ficha"));
  const tiraRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tiraRef.current?.querySelector(`[data-tab="${tab}"]`)?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [tab]);

  const b = d.beat;
  const precioPropio = LICENCIAS.some((id) => b.precios[id] !== d.preciosBase[id]);
  const pubs = d.publicaciones?.length ?? 0;
  // Cada guardado cambia updated_at: la llave vuelve a montar la pestaña con lo guardado.
  const llave = `${tab}-${d.ficha.updated_at ?? "nuevo"}`;

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 mb-5">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
          {b.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.artworkLarge || b.artworkUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music2 size={26} className="text-white/25" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-coolvetica text-2xl sm:text-3xl text-white leading-tight break-words">{b.title}</h1>
          <p className="text-xs text-white/40 mt-1">
            {d.id} · {b.bpm ? `${b.bpm} BPM` : "— BPM"} · {b.key && b.key !== "—" ? b.key : "—"} · {b.genre}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <Pastilla tono={d.source === "original" ? "neutro" : "info"}>{d.source}</Pastilla>
            {b.oculto ? <Pastilla tono="grave">oculto</Pastilla> : <Pastilla tono="ok">en la tienda</Pastilla>}
            {b.destacado && <Pastilla tono="alerta"><Star size={11} /> destacado</Pastilla>}
            {!d.audio && <Pastilla tono="alerta">sin audio</Pastilla>}
            {!d.carpeta && <Pastilla tono="grave">sin entrega</Pastilla>}
            {precioPropio && <Pastilla tono="info">precio propio</Pastilla>}
            {d.publicaciones && <Pastilla tono={pubs ? "neutro" : "alerta"}>{pubs ? `${pubs} en redes` : "sin promoción"}</Pastilla>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[12px]">
            {!b.oculto && (
              <a href={b.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white/55 hover:text-white">
                <ExternalLink size={12} /> Ver en la tienda
              </a>
            )}
            {b.beatstarsUrl && (
              <a href={b.beatstarsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white/55 hover:text-white">
                <ExternalLink size={12} /> BeatStars
              </a>
            )}
          </div>
        </div>
      </div>

      {!d.tablaFicha && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-3 py-2.5 mb-5">
          <AlertTriangle size={15} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="text-[12px] text-white/70 leading-relaxed">
            <span className="font-medium text-amber-300">Falta correr <code>supabase-beat-ficha.sql</code> en Supabase.</span> Mientras tanto
            puedes ver todo, pero no guardar cambios de ficha, precios, portada ni promoción.
          </p>
        </div>
      )}

      <div ref={tiraRef} className="flex items-center gap-1 border-b border-white/8 mb-5 overflow-x-auto hide-scrollbar">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-tab={t.id}
            className={`relative px-3.5 py-2.5 text-sm whitespace-nowrap transition-colors cursor-pointer ${tab === t.id ? "text-white" : "text-white/40 hover:text-white/70"}`}>
            {t.label}
            {tab === t.id && <motion.div layoutId="beat-tab-underline" className="absolute left-0 right-0 -bottom-px h-0.5 bg-lgb-red" />}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={llave} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
          {tab === "ficha" && <FichaTab d={d} />}
          {tab === "tienda" && <TiendaTab d={d} />}
          {tab === "portada" && <PortadaTab d={d} />}
          {tab === "entrega" && <EntregaTab d={d} />}
          {tab === "promocion" && <PromocionTab d={d} />}
          {tab === "ventas" && d.ventas && <VentasTab ventas={d.ventas} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
