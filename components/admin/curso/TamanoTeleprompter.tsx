"use client";
import { useEffect, useSyncExternalStore } from "react";

const CLAVE = "arido-teleprompter-rem";
const EVENTO = "arido-teleprompter";
const TAMANOS = [1.1, 1.3, 1.5, 1.8, 2.2, 2.6];
const DEFAULT = 2;

// El tamaño vive en localStorage (se recuerda en este dispositivo); el
// componente lo lee como una fuente externa, sin copiarlo a su estado.
const suscribir = (cb: () => void) => {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENTO, cb); window.removeEventListener("storage", cb); };
};
const leer = (): number => {
  try {
    const j = TAMANOS.indexOf(Number(localStorage.getItem(CLAVE)));
    return j >= 0 ? j : DEFAULT;
  } catch {
    return DEFAULT;
  }
};
const guardar = (i: number) => {
  try { localStorage.setItem(CLAVE, String(TAMANOS[i])); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event(EVENTO));
};

/** A− / A+ para la letra del modo grabación. */
export function TamanoTeleprompter() {
  const i = useSyncExternalStore(suscribir, leer, () => DEFAULT);

  useEffect(() => {
    document.documentElement.style.setProperty("--tp-size", `${TAMANOS[i]}rem`);
  }, [i]);

  const btn = "w-9 h-9 rounded-full bg-white/8 text-white/80 hover:text-white disabled:opacity-30 cursor-pointer text-sm font-medium";
  return (
    <div className="flex items-center gap-1.5" aria-label="Tamaño de letra">
      <button onClick={() => guardar(Math.max(0, i - 1))} disabled={i === 0} className={btn} aria-label="Letra más chica">A−</button>
      <button onClick={() => guardar(Math.min(TAMANOS.length - 1, i + 1))} disabled={i === TAMANOS.length - 1} className={btn} aria-label="Letra más grande">A+</button>
    </div>
  );
}
