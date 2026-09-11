"use client";
import { Music4, Package, Layers, Download, History } from "lucide-react";
import type { RenderDelPedido } from "@/lib/cuenta-cliente";

/**
 * Lo que el estudio le compartió al cliente: previos para escuchar y archivos
 * finales para descargar.
 *
 * El audio se reproduce con el <audio> nativo apuntando al proxy del sitio, no
 * a Drive: el archivo nunca sale de su sesión y el navegador se encarga solo de
 * la barra de progreso y el volumen.
 *
 * Reproducir embebido es SÓLO para el previo en MP3 (~3 MB). Los entregables en
 * WAV y los stems se descargan: cada reproducción pasa por una función
 * serverless, y mover decenas de MB por ahí cada vez que alguien arrastra la
 * barra no tiene sentido. Quién puede oírse lo decide el servidor, no esto.
 *
 * De los previos se ve sólo el ÚLTIMO de cada tema; los anteriores quedan
 * plegados. Con cinco versiones apiladas, el cliente escuchaba la vieja y nos
 * pedía cambios que ya estaban hechos.
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

function Tarjeta({ pedidoId, r, tenue }: { pedidoId: string; r: RenderDelPedido; tenue?: boolean }) {
  const Icono = ICONO[r.tipo];
  const titulo = r.tipo === "previo" && r.previoNum && r.previoNum > 1
    ? `Previo ${r.previoNum}`
    : TITULO[r.tipo];

  return (
    <div className={`border rounded-2xl p-4 ${tenue ? "bg-white/[0.02] border-white/5" : "bg-white/5 border-white/10"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icono size={15} className={`${tenue ? "text-white/30" : "text-lgb-red"} shrink-0`} />
        <p className={`text-sm font-medium ${tenue ? "text-white/60" : ""}`}>{titulo}</p>
        <span className="text-white/30 text-xs ml-auto shrink-0">{fecha(r.fecha)}</span>
      </div>

      <div className="flex flex-col gap-3">
        {r.archivos.map((a) => {
          const src = `/api/cuenta/pedido/${pedidoId}/archivo?job=${r.jobId}&i=${a.idx}`;
          // Sólo el previo se oye aquí; los archivos pesados se bajan.
          return a.audio ? (
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
              <audio controls preload="none" src={src} className="w-full h-9">
                Tu navegador no puede reproducir este audio.
              </audio>
            </div>
          ) : (
            <a
              key={a.idx}
              href={`${src}&d=1`}
              download={a.nombre}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
            >
              <Download size={14} className="text-white/40 group-hover:text-lgb-red shrink-0 transition-colors" />
              <span className="text-xs text-white/70 truncate min-w-0">{a.nombre}</span>
              <span className="ml-auto shrink-0 text-[11px] text-white/30">Descargar</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function RendersPedido({ pedidoId, renders }: { pedidoId: string; renders: RenderDelPedido[] }) {
  if (!renders.length) return null;

  // Lo final primero: es lo que vino a buscar.
  const finales = renders.filter((r) => r.tipo !== "previo");

  // Previos agrupados por tema (en una producción normal hay un solo grupo).
  // Ya vienen del más nuevo al más viejo, así que el primero es el vigente.
  const grupos = new Map<string, RenderDelPedido[]>();
  for (const r of renders.filter((x) => x.tipo === "previo")) {
    const k = r.tareaId ?? "";
    grupos.set(k, [...(grupos.get(k) ?? []), r]);
  }
  const varios = grupos.size > 1;

  return (
    <section className="mt-8">
      <h3 className="text-white/40 text-xs uppercase tracking-wide mb-3">Tu material</h3>
      <div className="flex flex-col gap-3">
        {finales.map((r) => <Tarjeta key={r.jobId} pedidoId={pedidoId} r={r} />)}

        {[...grupos.entries()].map(([k, lista]) => {
          const [ultimo, ...anteriores] = lista;
          return (
            <div key={k || "previos"} className="flex flex-col gap-2">
              {varios && ultimo.tema && <p className="text-white/50 text-xs mt-1">{ultimo.tema}</p>}
              <Tarjeta pedidoId={pedidoId} r={ultimo} />
              {anteriores.length > 0 && (
                <details className="group">
                  <summary className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 cursor-pointer select-none list-none px-1 py-1">
                    <History size={12} />
                    <span className="group-open:hidden">Ver previos anteriores ({anteriores.length})</span>
                    <span className="hidden group-open:inline">Ocultar previos anteriores</span>
                  </summary>
                  <div className="flex flex-col gap-2 mt-2">
                    {anteriores.map((r) => <Tarjeta key={r.jobId} pedidoId={pedidoId} r={r} tenue />)}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
