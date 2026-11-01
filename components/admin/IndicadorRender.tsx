"use client";
import type { RendersEnCurso } from "@/lib/render-jobs";

/** Silueta fija de la onda: alto de cada barra, en % del alto del indicador. */
const BARRAS = [40, 75, 100, 58, 84];
/** Desfase entre barras: lo que hace que la onda "se escriba" de izquierda a derecha. */
const PASO_MS = 110;

function describir({ enCola, renderizando, subiendo }: RendersEnCurso): string {
  const partes: string[] = [];
  if (renderizando) partes.push(renderizando > 1 ? `${renderizando} renderizando` : "Renderizando en REAPER");
  if (subiendo) partes.push(subiendo > 1 ? `${subiendo} subiendo a Drive` : "Subiendo a Drive");
  if (enCola) partes.push(`${enCola} en cola`);
  const texto = partes.join(" · ");
  return renderizando || subiendo ? texto : `${texto} · espera a la PC del estudio`;
}

/**
 * La onda junto a "REAPER" en el menú: dice que la PC del estudio está
 * trabajando sin tener que entrar a ver.
 *
 *   ▂▅█▃▆  ámbar, se enciende de izquierda a derecha   renderizando
 *   ▂▅█▃▆  azul, igual                                  subiendo a Drive
 *   ▂▅█▃▆  tenue y quieta                               sólo hay cola
 *
 * Una onda que se va escribiendo es lo que enseña la ventana de render de
 * REAPER; un círculo de carga no dice nada de audio. Los colores son los de
 * la píldora de la entrega (EntregaEstado) para que signifiquen lo mismo.
 *
 * `activo`: el link está seleccionado (fondo rojo) y la onda toma su blanco.
 * `chico`: para el encabezado de un área cerrada y la barra del celular.
 */
export function IndicadorRender({ r, activo = false, chico = false, className = "" }: {
  r: RendersEnCurso; activo?: boolean; chico?: boolean; className?: string;
}) {
  const total = r.enCola + r.renderizando + r.subiendo;
  if (!total) return null;

  const trabajando = r.renderizando + r.subiendo > 0;
  const color = activo
    ? (trabajando ? "" : "opacity-50")
    : r.renderizando ? "text-amber-400 light:text-amber-600"
    : r.subiendo ? "text-sky-400 light:text-sky-600"
    : "text-white/30";
  const texto = describir(r);

  return (
    <span
      role="img"
      aria-label={texto}
      title={texto}
      className={`inline-flex items-center shrink-0 ${chico ? "h-2.5 gap-px" : "h-3 gap-[1.5px]"} ${color} ${className}`}
    >
      {BARRAS.map((alto, i) => (
        <span
          key={i}
          className={`${chico ? "w-[1.5px]" : "w-[2px]"} rounded-full bg-current ${trabajando ? "onda-render" : ""}`}
          style={{ height: `${alto}%`, animationDelay: `${i * PASO_MS}ms` }}
        />
      ))}
      {/* Cuántos, sólo si hay más de uno y hay espacio: en el menú de escritorio. */}
      {total > 1 && !chico && <span className="ml-1.5 text-[11px] leading-none tabular-nums">{total}</span>}
    </span>
  );
}
