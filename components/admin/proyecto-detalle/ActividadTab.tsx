"use client";
import { DOT_ACTIVIDAD } from "@/lib/actividad-modulos";
import type { ActividadItem } from "@/lib/erp-data";

function hace(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

/** Bitácora de este proyecto — mismos datos y colores que la campanita, ya vienen incluidos en getProyectoDetalle (sin fetch aparte). */
export function ActividadTab({ actividad }: { actividad: ActividadItem[] }) {
  if (!actividad.length) return <p className="text-sm text-white/30">Sin movimientos registrados todavía.</p>;
  return (
    <ul className="space-y-0.5">
      {actividad.map((it) => (
        <li key={it.id} className="flex gap-2.5 px-1 py-2 border-b border-white/5 last:border-0">
          <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${DOT_ACTIVIDAD[it.tipo] || "bg-white/40"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-white/80 leading-snug break-words">{it.titulo}</p>
            <p className="text-[11px] text-white/35 mt-0.5">{hace(it.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
