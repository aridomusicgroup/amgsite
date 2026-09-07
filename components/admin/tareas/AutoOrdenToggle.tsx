"use client";
import { ArrowDownNarrowWide, GripVertical } from "lucide-react";

/**
 * Interruptor del acomodo automático (ver ./auto-orden.ts).
 *
 * Dice en qué modo está, no qué va a pasar al tocarlo: la etiqueta es el estado
 * actual. Así quien lo ve de reojo sabe por qué la lista se movió sola.
 */
export function AutoOrdenToggle({ activo, onChange }: { activo: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!activo)}
      aria-pressed={activo}
      title={
        activo
          ? "Las completadas se van al final solas. Toca para reordenar a mano."
          : "Orden manual: arrastra las tareas. Toca para que las completadas se vayan al final."
      }
      className={`flex items-center gap-1 shrink-0 rounded-full border px-2 py-0.5 text-[10px] transition-colors cursor-pointer ${
        activo
          ? "border-lgb-red/40 bg-lgb-red/10 text-lgb-red hover:bg-lgb-red/20"
          : "border-white/12 bg-white/[0.03] text-white/40 hover:text-white/70 hover:bg-white/[0.07]"
      }`}
    >
      {activo ? <ArrowDownNarrowWide size={11} /> : <GripVertical size={11} />}
      {activo ? "Completadas al final" : "Orden manual"}
    </button>
  );
}
