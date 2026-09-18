"use client";
import type { CursoLeccion } from "@/lib/cursos-admin";
import { ESTADOS_PRODUCCION, camposPendientes, type EstadoProduccion } from "@/lib/cursos-tipos";

export type FiltroProduccion = "todas" | EstadoProduccion | "publicadas" | "sin_publicar";

export const pasaFiltro = (l: CursoLeccion, f: FiltroProduccion): boolean => {
  if (f === "todas") return true;
  if (f === "publicadas") return l.publicada;
  if (f === "sin_publicar") return !l.publicada;
  return l.estadoProduccion === f;
};

/**
 * Cuánto falta para lanzar: lecciones por estado de producción, cuántas ya
 * están publicadas y cuántos campos del guion siguen con [RELLENAR]. Las
 * píldoras filtran la lista de abajo.
 */
export function ResumenProduccion({ lecciones, filtro, onFiltro }: {
  lecciones: CursoLeccion[]; filtro: FiltroProduccion; onFiltro: (f: FiltroProduccion) => void;
}) {
  const total = lecciones.length;
  if (!total) return null;
  const publicadas = lecciones.filter((l) => l.publicada).length;
  const listas = lecciones.filter((l) => l.estadoProduccion === "editado" || l.publicada).length;
  const rellenar = lecciones.reduce((n, l) => n + (l.tipo === "quiz" ? 0 : camposPendientes(l.contenido, l.etiqueta)), 0);
  const pct = Math.round((listas / total) * 100);

  const chips: { id: FiltroProduccion; label: string; n: number }[] = [
    { id: "todas", label: "Todas", n: total },
    ...ESTADOS_PRODUCCION.map((e) => ({ id: e.id as FiltroProduccion, label: e.label, n: lecciones.filter((l) => l.estadoProduccion === e.id).length })),
    { id: "publicadas", label: "Publicadas", n: publicadas },
    { id: "sin_publicar", label: "Sin publicar", n: total - publicadas },
  ];

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <p className="text-sm">
          <b>{listas}</b> de {total} lecciones listas · <b>{publicadas}</b> publicadas
        </p>
        <p className="text-white/40 text-xs">{rellenar} campos del guion por escribir</p>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-3">
        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button key={c.id} onClick={() => onFiltro(c.id)}
            className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors ${filtro === c.id ? "bg-white/15 text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>
            {c.label} <span className="text-white/40">{c.n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
