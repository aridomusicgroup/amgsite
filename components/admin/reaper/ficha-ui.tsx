"use client";
import { AlertCircle, Loader2 } from "lucide-react";
import type { RenderJob } from "@/lib/render-jobs";

/** Piezas chicas que comparten las secciones de la ficha de REAPER. */

export const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

export type Tono = "ok" | "pend" | "nada" | "error";

const TONO_TXT: Record<Tono, string> = {
  ok: "text-green-300",
  pend: "text-amber-300",
  nada: "text-white/45",
  error: "text-red-300",
};
const TONO_PUNTO: Record<Tono, string> = {
  ok: "bg-green-400",
  pend: "bg-amber-400",
  nada: "bg-white/20",
  error: "bg-red-400",
};

export function Seccion({ id, titulo, extra, children }: {
  id: string; titulo: string; extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="bg-lgb-surface border border-white/5 rounded-2xl p-4 scroll-mt-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 id={`${id}-t`} className="font-coolvetica text-lg">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Un renglón de lista: icono, qué es, cuándo, y a la derecha su estado/acciones. */
export function Fila({ icono, titulo, detalle, children }: {
  icono: React.ReactNode; titulo: React.ReactNode; detalle?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-white/30 shrink-0">{icono}</span>
        <div className="min-w-0">
          <p className="text-sm text-white/80 truncate">{titulo}</p>
          {detalle && <p className="text-[11px] text-white/35 truncate">{detalle}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap sm:justify-end sm:shrink-0 pl-6 sm:pl-0">{children}</div>}
    </div>
  );
}

/** Cuadro del resumen de arriba: una cosa, cómo va, y un salto a su sección. */
export function Cuadro({ href, etiqueta, txt, sub, tono }: {
  href: string; etiqueta: string; txt: string; sub: string; tono: Tono;
}) {
  return (
    <a href={href}
      className="group block rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30">
      <p className="text-[11px] text-white/35 uppercase tracking-wider flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${TONO_PUNTO[tono]}`} aria-hidden />
        {etiqueta}
      </p>
      <p className={`text-sm font-medium mt-1 ${TONO_TXT[tono]}`}>{txt}</p>
      <p className="text-[11px] text-white/35 mt-0.5 truncate">{sub}</p>
    </a>
  );
}

/** Estado de un render que no es "listo": en cola, renderizando, o falló. */
export function EstadoJob({ job }: { job: RenderJob }) {
  if (job.estado === "error") {
    return (
      <span title={job.error ?? undefined} className="flex items-center gap-1 text-[11px] text-red-300">
        <AlertCircle size={11} /> falló
      </span>
    );
  }
  if (job.estado !== "listo") {
    const txt = job.estado === "pendiente" ? "en cola" : job.estado === "subiendo" ? "subiendo" : "renderizando";
    return <span className="flex items-center gap-1 text-[11px] text-amber-300"><Loader2 size={11} className="animate-spin" /> {txt}</span>;
  }
  return <span className="text-[11px] text-green-300/80">listo</span>;
}
