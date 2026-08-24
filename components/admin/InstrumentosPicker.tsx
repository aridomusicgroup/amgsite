"use client";
import { useState } from "react";

/**
 * Selector de instrumentos (chips + personalizado). Compartido por el panel de
 * Producción, Nueva venta y Convertir cotización en venta: cada instrumento
 * elegido genera una tarea "Grabar {instrumento}" en el proyecto.
 * `value` es la lista separada por comas (formato que espera la API).
 */
export const INSTRUMENTOS_COMUNES = [
  "Armonía", "Guitarra", "Requinto", "Bajoquinto", "Bajo sexto", "Bajoloche", "Bass",
  "Tololoche", "Charchetas", "Trombón", "Acordeón", "Batería", "Tuba", "Trompeta",
  "Saxofón", "Teclado", "Voz", "Coros",
];

const inp =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";

export function InstrumentosPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState("");
  const sel = value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const has = (i: string) => sel.some((s) => s.toLowerCase() === i.toLowerCase());
  const toggle = (i: string) =>
    onChange((has(i) ? sel.filter((s) => s.toLowerCase() !== i.toLowerCase()) : [...sel, i]).join(", "));
  const addCustom = () => {
    const c = custom.trim();
    if (c && !has(c)) onChange([...sel, c].join(", "));
    setCustom("");
  };
  // Instrumentos elegidos que no están en la lista común (ej. inferidos raros o custom)
  const extrasSel = sel.filter((s) => !INSTRUMENTOS_COMUNES.some((i) => i.toLowerCase() === s.toLowerCase()));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {INSTRUMENTOS_COMUNES.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
              has(i) ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"
            }`}
          >
            {i}
          </button>
        ))}
        {extrasSel.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className="px-2.5 py-1 rounded-full text-xs bg-lgb-red text-white"
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="+ otro instrumento"
          className={inp}
        />
        <button type="button" onClick={addCustom} className="bg-white/10 hover:bg-white/15 text-white px-3 rounded-lg text-sm shrink-0">
          Add
        </button>
      </div>
      {sel.length > 0 && (
        <p className="text-[11px] text-white/40">Se crearán: {sel.map((s) => `Grabar ${s}`).join(" · ")}</p>
      )}
    </div>
  );
}
