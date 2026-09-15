"use client";
import { AlertTriangle } from "lucide-react";
import { alternarConcepto, descuadres, etiquetasDe, type ItemCotizado, type Tema } from "@/lib/temas";

/**
 * Qué lleva cada tema de un EP/álbum: una fila por tema, una columna por
 * concepto cotizado.
 *
 * La cantidad de un concepto es en cuántos temas va ("Trombón ×2" = dos temas),
 * y aquí se palomea en cuáles. De esta tabla sale todo lo de después: las
 * subtareas "Grabar X" de cada tema, a qué tema se cuelga cada músico, la
 * plantilla de REAPER de cada canción y el desglose del PDF.
 */
export function TemasEditor({ temas, items, onChange }: {
  temas: Tema[];
  items: ItemCotizado[];
  onChange: (temas: Tema[]) => void;
}) {
  const labels = etiquetasDe(items);
  const avisos = descuadres(temas, items);
  const renombrar = (i: number, nombre: string) => onChange(temas.map((t, j) => (j === i ? { ...t, nombre } : t)));

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-white/60 text-xs mb-2">
        Temas <span className="text-white/30">(nombre exacto, o vacío = “Canción N” · palomea qué lleva cada uno)</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-y-1">
          <thead>
            <tr>
              <th className="text-left font-normal text-white/35 pr-2 min-w-36">Tema</th>
              {labels.map((l) => (
                <th key={l} className="font-normal text-white/45 px-1.5 text-center whitespace-nowrap">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {temas.map((t, i) => {
              const nombre = t.nombre || `Canción ${i + 1}`;
              return (
                <tr key={i}>
                  <td className="pr-2">
                    <input
                      value={t.nombre}
                      onChange={(e) => renombrar(i, e.target.value)}
                      placeholder={`Canción ${i + 1}`}
                      maxLength={120}
                      aria-label={`Nombre del tema ${i + 1}`}
                      className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-white/30"
                    />
                  </td>
                  {labels.map((l) => (
                    <td key={l} className="text-center px-1.5">
                      <input
                        type="checkbox"
                        checked={t.conceptos.includes(l)}
                        onChange={() => onChange(alternarConcepto(temas, i, l, items))}
                        aria-label={`${l} en ${nombre}`}
                        className="accent-lgb-red w-4 h-4 cursor-pointer"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {labels.length === 0 && (
        <p className="text-[11px] text-white/35 mt-1">Agrega los conceptos y aquí palomeas en qué tema va cada uno.</p>
      )}
      {avisos.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {avisos.map((a) => (
            <li key={a.concepto} className="flex items-start gap-1.5 text-[11px] text-amber-300/80">
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
              {a.concepto}: cotizaste ×{a.cantidad} y está en {a.marcados} {a.marcados === 1 ? "tema" : "temas"}.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
