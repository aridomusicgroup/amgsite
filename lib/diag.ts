"use client";

/**
 * Diagnóstico del scroll, encendido a mano con `?debug=scroll` en la URL.
 *
 * Existe porque el resplandor llegaba bien y a los segundos la ventana se iba
 * sola hasta arriba, y ya se falló tres veces intentando adivinar la causa. En
 * esta herramienta NO se puede reproducir: el panel del navegador ni siquiera
 * hace scroll (`window.scrollTo` deja `scrollY` en 0) ni corre
 * `requestAnimationFrame`. Así que la medición tiene que pasar en el navegador
 * de verdad, con el panel de verdad.
 *
 * Apagado por defecto: sin el parámetro, `diag()` no hace absolutamente nada.
 */

let activo: boolean | null = null;

const LLAVE = "arido-debug-scroll";

/**
 * ¿Está encendido el diagnóstico? Se resuelve una vez y se recuerda.
 *
 * Queda PEGADO en la pestaña (`sessionStorage`) porque la prueba real es tocar
 * una notificación, y esa URL la arma el servidor sin `?debug=scroll`. Se
 * enciende una vez a mano y sigue prendido hasta cerrar la pestaña o entrar con
 * `?debug=off`.
 */
export function diagActivo(): boolean {
  if (activo !== null) return activo;
  if (typeof window === "undefined") return false;
  try {
    const p = new URLSearchParams(window.location.search).get("debug");
    if (p === "scroll") sessionStorage.setItem(LLAVE, "1");
    if (p === "off") sessionStorage.removeItem(LLAVE);
    activo = sessionStorage.getItem(LLAVE) === "1";
  } catch {
    activo = false;
  }
  return activo;
}

export interface DiagEvento {
  /** Milisegundos desde que cargó la página. */
  t: number;
  msg: string;
  /** Posición del scroll en ese momento. */
  y: number;
}

export const DIAG_EVENTO = "arido-diag";

/** Anota un momento en la línea de tiempo. No-op si el diagnóstico está apagado. */
export function diag(msg: string): void {
  if (!diagActivo()) return;
  try {
    const d: DiagEvento = { t: Math.round(performance.now()), msg, y: Math.round(window.scrollY) };
    window.dispatchEvent(new CustomEvent<DiagEvento>(DIAG_EVENTO, { detail: d }));
  } catch { /* el diagnóstico jamás rompe la app */ }
}
