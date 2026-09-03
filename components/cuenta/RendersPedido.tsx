"use client";
import { Music4, Package, Layers, Download } from "lucide-react";
import type { RenderDelPedido } from "@/lib/cuenta-cliente";

/**
 * Lo que el estudio le compartió al cliente: previos para escuchar y archivos
 * finales para descargar.
 *
 * El audio se reproduce con el <audio> nativo apuntando al proxy del sitio, no
 * a Drive: el archivo nunca sale de su sesión y el navegador se encarga solo de
 * la barra de progreso y el volumen.
 */

const ICONO = {
  previo: Music4,
  entregables: Package,
  stems: Layers,
} as const;

const TITULO = {
  previo: "Previo",
  entregables: "Archivos finales",
  stems: "Stems",
} as const;

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long" });

export function RendersPedido({ pedidoId, renders }: { pedidoId: string; renders: RenderDelPedido[] }) {
  if (!renders.length) return null;

  return (
    <section className="mt-8">
      <h3 className="text-white/40 text-xs uppercase tracking-wide mb-3">Tu material</h3>
      <div className="flex flex-col gap-3">
        {renders.map((r) => {
          const Icono = ICONO[r.tipo];
          const titulo = r.tipo === "previo" && r.previoNum && r.previoNum > 1
            ? `Previo ${r.previoNum}`
            : TITULO[r.tipo];

          return (
            <div key={r.jobId} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icono size={15} className="text-lgb-red shrink-0" />
                <p className="text-sm font-medium">{titulo}</p>
                <span className="text-white/30 text-xs ml-auto shrink-0">{fecha(r.fecha)}</span>
              </div>

              <div className="flex flex-col gap-3">
                {r.archivos.map((a) => {
                  const src = `/api/cuenta/pedido/${pedidoId}/archivo?job=${r.jobId}&i=${a.idx}`;
                  return (
                    <div key={a.idx}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-white/60 truncate min-w-0">{a.nombre}</span>
                        <a
                          href={`${src}&d=1`}
                          download={a.nombre}
                          className="ml-auto shrink-0 text-white/40 hover:text-white transition-colors"
                          aria-label={`Descargar ${a.nombre}`}
                          title="Descargar"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                      {a.audio && (
                        <audio controls preload="none" src={src} className="w-full h-9">
                          Tu navegador no puede reproducir este audio.
                        </audio>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
