"use client";
import { ExternalLink } from "lucide-react";
import type { ProyectoDetalle } from "@/lib/erp-data";

/** Métricas reales de IG/FB, ligadas por shortcode del link del post (ya vienen resueltas en getProyectoDetalle). */
export function RedesTab({ proyecto }: { proyecto: ProyectoDetalle }) {
  const nf = (n: number) => n.toLocaleString("es-MX");
  return (
    <div className="space-y-3">
      {proyecto.plataforma && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
          <span className="px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-300 text-xs">{proyecto.plataforma}</span>
          {proyecto.fecha_publicacion && <span>Publica {new Date(proyecto.fecha_publicacion + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>}
          {proyecto.link_post && (
            <a href={proyecto.link_post} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline flex items-center gap-1">Ver post <ExternalLink size={12} /></a>
          )}
        </div>
      )}
      {proyecto.metricas ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {proyecto.metricas.reproducciones > 0 && <Metrica label="Reproducciones" valor={nf(proyecto.metricas.reproducciones)} />}
          <Metrica label="Me gusta" valor={nf(proyecto.metricas.likes)} />
          <Metrica label="Comentarios" valor={nf(proyecto.metricas.comentarios)} />
          {proyecto.metricas.compartidos > 0 && <Metrica label="Compartidos" valor={nf(proyecto.metricas.compartidos)} />}
          {proyecto.metricas.guardados > 0 && <Metrica label="Guardados" valor={nf(proyecto.metricas.guardados)} />}
        </div>
      ) : (
        <p className="text-sm text-white/30">{proyecto.link_post ? "Métricas: se ligan solas tras la sincronización de Analítica." : "Sin post ligado todavía."}</p>
      )}
    </div>
  );
}

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
      <p className="text-white/40 text-[11px] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-white font-coolvetica text-xl">{valor}</p>
    </div>
  );
}
