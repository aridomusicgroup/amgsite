"use client";
import { useMemo, useState } from "react";
import { ChevronRight, VolumeX } from "lucide-react";
import type { PistaRpp } from "@/lib/render-jobs";
import { alternarSilencio, hijasDe } from "@/lib/silenciar-pistas";

/** Con tantas pistas o menos, buscar estorba más de lo que ayuda. */
const PISTAS_PARA_BUSCADOR = 12;

/**
 * Canales a dejar fuera de la mezcla (previo, previo de músico, entregables).
 *
 * Va CERRADO: es una excepción, no parte del flujo normal. Lo que sí queda a la
 * vista, ya cerrado, es cuántos hay elegidos — si no, es fácil mandar un
 * entregable sin la guitarra por haber palomeado algo hace rato.
 */
export function SilenciarPistas({
  pistas, elegidas, onChange, ayuda,
}: {
  pistas: PistaRpp[];
  elegidas: ReadonlySet<string>;
  onChange: (s: Set<string>) => void;
  /** Una línea de contexto según para qué es el render. */
  ayuda?: string;
}) {
  const [filtro, setFiltro] = useState("");
  // Inventario publicado antes de que existiera el `id`: el script local lo
  // renueva solo en su siguiente corrida (cada 2 min).
  const sinId = pistas.length > 0 && pistas.some((t) => t.id === undefined);
  const buscar = pistas.length > PISTAS_PARA_BUSCADOR;
  // Sin buscador a la vista no puede quedar un filtro puesto: al cambiar a un
  // .rpp con pocas pistas habría filas ocultas y nada con qué limpiarlas.
  const q = buscar ? filtro.trim().toLowerCase() : "";

  const nombres = useMemo(
    () => pistas.filter((t) => t.id && elegidas.has(t.id)).map((t) => t.nombre),
    [pistas, elegidas],
  );

  return (
    <details className="group rounded-xl border border-white/10 bg-white/5">
      <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} className="text-white/40 shrink-0 transition-transform group-open:rotate-90" />
        <VolumeX size={13} className="text-white/50 shrink-0" />
        <span className="text-sm">Silenciar canales</span>
        <span
          title={nombres.join(", ")}
          className={`ml-auto text-[11px] truncate ${nombres.length ? "text-amber-300" : "text-white/30"}`}
        >
          {nombres.length ? `${nombres.length} silenciado${nombres.length === 1 ? "" : "s"}` : "opcional"}
        </span>
      </summary>

      <div className="px-3 pb-3 flex flex-col gap-2">
        {pistas.length === 0 ? (
          <p className="text-white/40 text-sm">No se encontraron pistas en este proyecto.</p>
        ) : sinId ? (
          <p className="text-[11px] text-amber-300 leading-relaxed">
            El script local todavía está leyendo las pistas de este proyecto (lo hace cada 2
            minutos). Cierra y vuelve a abrir este cuadro en un momento.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-white/40 leading-relaxed">
              {ayuda ?? "El render sale sin estos canales."} Al elegir una carpeta se apaga también
              todo lo que trae adentro.
            </p>

            {buscar && (
              <input
                type="search" value={filtro} placeholder="Buscar pista…"
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-lgb-red"
              />
            )}

            <div className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
              {pistas.map((t, i) => {
                if (q && !t.nombre.toLowerCase().includes(q)) return null;
                const hijas = hijasDe(pistas, i).length;
                return (
                  <label
                    key={t.id ?? `${t.nombre}-${i}`}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm ${
                      t.silenciada ? "opacity-40" : "hover:bg-white/5 cursor-pointer"
                    }`}
                    style={{ paddingLeft: `${8 + Math.min(t.profundidad, 3) * 16}px` }}
                  >
                    <input
                      type="checkbox"
                      disabled={t.silenciada || !t.id}
                      checked={Boolean(t.id && elegidas.has(t.id))}
                      onChange={() => onChange(alternarSilencio(elegidas, pistas, i))}
                      className="accent-lgb-red"
                    />
                    <span className="truncate">{t.nombre}</span>
                    {hijas > 0 && <span className="text-[11px] text-white/30 shrink-0">carpeta · {hijas}</span>}
                    {t.silenciada && <span className="text-[11px] text-white/40 shrink-0">ya silenciada</span>}
                  </label>
                );
              })}
            </div>

            {nombres.length > 0 && (
              <button
                type="button" onClick={() => onChange(new Set())}
                className="self-start text-[11px] text-white/50 hover:text-white underline underline-offset-2 cursor-pointer"
              >
                Quitar todos
              </button>
            )}
          </>
        )}
      </div>
    </details>
  );
}
