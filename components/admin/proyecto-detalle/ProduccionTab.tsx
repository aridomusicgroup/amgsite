"use client";
import { ExternalLink, FileAudio } from "lucide-react";
import type { ProyectoDetalle } from "@/lib/erp-data";

const TIPO_LABEL: Record<string, string> = { previo: "Previo", entregables: "Entregables", stems: "Stems" };
const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-white/8 text-white/50", procesando: "bg-amber-500/15 text-amber-300",
  listo: "bg-green-500/15 text-green-300", error: "bg-red-500/15 text-red-300",
};

/** Solo lectura: pedir un render nuevo sigue siendo cosa de REAPER (reaper-sync) — esta pestaña es visibilidad, no control. */
export function ProduccionTab({ proyecto }: { proyecto: ProyectoDetalle }) {
  if (!proyecto.renderJobs.length && !proyecto.renderInventario.length) {
    return <p className="text-sm text-white/30">Sin renders todavía — se generan desde REAPER (reaper-sync).</p>;
  }
  return (
    <div className="space-y-4">
      {proyecto.renderJobs.length > 0 && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-2">Renders</p>
          <div className="space-y-1.5">
            {proyecto.renderJobs.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileAudio size={14} className="text-white/30 shrink-0" />
                  <span className="text-sm text-white/75">{TIPO_LABEL[r.tipo] ?? r.tipo}</span>
                  <span className="text-xs text-white/30">{new Date(r.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${ESTADO_COLOR[r.estado] ?? "bg-white/8 text-white/50"}`}>{r.estado}</span>
                  {r.drive_urls?.[0] && (
                    <a href={r.drive_urls[0]} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white"><ExternalLink size={13} /></a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {proyecto.renderInventario.length > 0 && (
        <p className="text-xs text-white/30">Inventario de REAPER: {proyecto.renderInventario.length} pista(s) escaneada(s) desde la última sincronización.</p>
      )}
    </div>
  );
}
