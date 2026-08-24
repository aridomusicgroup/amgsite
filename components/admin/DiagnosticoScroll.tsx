"use client";
import { useEffect, useRef, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { diagActivo, DIAG_EVENTO, type DiagEvento } from "@/lib/diag";

const MAX = 400;

/**
 * Caja de diagnóstico del scroll (`?debug=scroll`). Invisible sin ese parámetro.
 *
 * Graba tres cosas y las junta en una sola línea de tiempo:
 *  1. Cada cambio de posición del scroll (muestreo cada 16 ms).
 *  2. Quién llamó a `scrollTo` / `scrollIntoView`, con el rastro de llamadas —
 *     así se ve si el salto lo mete nuestro código, Next o el navegador.
 *  3. Los momentos que marca la app (`diag()`): montaje, lectura de
 *     `?destacar=`, cada corrección del anclaje, cada `router.refresh()`.
 *
 * Lo que NO se puede saber sin esto: si el brinco viene ANTES o DESPUÉS de que
 * centramos, y si algo vuelve a moverlo. Eso es justo lo que decide el arreglo.
 */
export function DiagnosticoScroll() {
  const [eventos, setEventos] = useState<DiagEvento[]>([]);
  const [cerrado, setCerrado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // Arranca en false SIEMPRE: si se leyera `diagActivo()` durante el render, el
  // servidor pintaría nada y el cliente la caja, y eso rompe la hidratación.
  const [encendido, setEncendido] = useState(false);
  const buffer = useRef<DiagEvento[]>([]);

  useEffect(() => {
    if (!diagActivo()) return;
    setEncendido(true);

    const anotar = (msg: string, y = Math.round(window.scrollY)) => {
      buffer.current = [...buffer.current, { t: Math.round(performance.now()), msg, y }].slice(-MAX);
    };

    anotar(`— arranca el diagnóstico · alto ventana ${window.innerHeight}`);

    // 1. Quién mueve el scroll, con rastro de llamadas.
    const scrollToOrig = window.scrollTo.bind(window);
    const intoViewOrig = Element.prototype.scrollIntoView;
    const culpable = () => {
      const pila = (new Error().stack ?? "").split("\n").slice(3, 5).join(" ⟵ ");
      // Los nombres se minifican en producción; aun así el archivo/línea sirve.
      return pila.replace(/https?:\/\/[^)]*\/_next\//g, "…/").trim() || "(sin rastro)";
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).scrollTo = (...args: any[]) => {
      anotar(`scrollTo(${JSON.stringify(args[0])}) ← ${culpable()}`);
      return (scrollToOrig as (...a: unknown[]) => void)(...args);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Element.prototype.scrollIntoView = function (this: Element, ...args: any[]) {
      anotar(`scrollIntoView ← ${culpable()}`);
      return (intoViewOrig as (...a: unknown[]) => void).apply(this, args);
    };

    // 2. Muestreo: solo se guardan los CAMBIOS, si no son 60 renglones por segundo.
    let ultimo = Math.round(window.scrollY);
    const muestreo = setInterval(() => {
      const y = Math.round(window.scrollY);
      if (Math.abs(y - ultimo) > 2) {
        anotar(`scroll ${ultimo} → ${y}${Math.abs(y - ultimo) > 200 ? "   ⚠️ SALTO GRANDE" : ""}`, y);
        ultimo = y;
      }
    }, 16);

    // 3. Marcas que manda la app.
    const alEvento = (e: Event) => {
      const d = (e as CustomEvent<DiagEvento>).detail;
      buffer.current = [...buffer.current, d].slice(-MAX);
    };
    window.addEventListener(DIAG_EVENTO, alEvento);

    // Refresco de la caja aparte del muestreo: pintar 60 veces por segundo
    // metería ruido justo en lo que se quiere medir.
    const pintar = setInterval(() => setEventos(buffer.current), 400);

    return () => {
      clearInterval(muestreo);
      clearInterval(pintar);
      window.removeEventListener(DIAG_EVENTO, alEvento);
      window.scrollTo = scrollToOrig;
      Element.prototype.scrollIntoView = intoViewOrig;
    };
  }, []);

  if (!encendido || cerrado) return null;

  const texto = eventos.map((e) => `${String(e.t).padStart(6)}ms  y=${String(e.y).padStart(5)}  ${e.msg}`).join("\n");

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* sin permiso de portapapeles: queda el texto en pantalla */ }
  };

  return (
    <div className="fixed bottom-24 md:bottom-4 left-4 z-[80] w-[min(94vw,30rem)] rounded-xl border border-amber-400/40 bg-black/95 backdrop-blur shadow-2xl">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <span className="text-[11px] font-bold text-amber-300">DIAGNÓSTICO DE SCROLL</span>
        <span className="text-[10px] text-white/35">{eventos.length} eventos</span>
        <button onClick={copiar} title="Copiar todo"
          className="ml-auto flex items-center gap-1 text-[10px] text-white/60 hover:text-white cursor-pointer">
          {copiado ? <Check size={12} className="text-green-400" /> : <Copy size={12} />} Copiar
        </button>
        <button onClick={() => setCerrado(true)} className="text-white/40 hover:text-white cursor-pointer"><X size={14} /></button>
      </div>
      <pre className="max-h-[45vh] overflow-auto px-3 py-2 text-[10px] leading-[1.45] text-white/75 whitespace-pre font-mono">
        {texto || "esperando movimiento…"}
      </pre>
    </div>
  );
}
