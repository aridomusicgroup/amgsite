"use client";
import { COMPASES } from "@/lib/compas";

/** Selector de compás. Vacío = sin definir (el .rpp se queda con el de la plantilla). */
export function CompasSelect({ value, onChange, className }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  // Uno guardado que no esté en la lista (ej. 9/8) se sigue viendo y no se pierde.
  const opciones = value && !COMPASES.includes(value) ? [value, ...COMPASES] : COMPASES;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Compás" className={className}>
      <option value="" className="bg-lgb-dark">— sin definir</option>
      {opciones.map((c) => <option key={c} value={c} className="bg-lgb-dark">{c}</option>)}
    </select>
  );
}
