"use client";
import { useEffect, useState } from "react";
import { diag } from "@/lib/diag";

/** Cuánto dura el resplandor (debe casar con la animación de globals.css). */
const DURACION = 4200;

const EVENTO = "arido-destacar";

/**
 * Bandera global: ¿hay un resplandor prendido ahora mismo?
 *
 * La lee `useRealtimeRefresh` para NO refrescar la pantalla en esos segundos.
 * Un `router.refresh()` re-renderiza el árbol del servidor y el navegador
 * pierde la posición del scroll: llegabas al elemento correcto y a los pocos
 * segundos la ventana se iba sola hasta arriba.
 */
let resplandorHasta = 0;
export const resplandorActivo = (): boolean => Date.now() < resplandorHasta;

/**
 * Prende el resplandor sin recargar la pantalla.
 *
 * Hace falta porque navegar a la MISMA ruta (de la campanita de Producción
 * estando ya en Producción, o desde el service worker) no vuelve a montar el
 * componente, así que el efecto que lee la URL nunca se dispara de nuevo.
 */
export function avisarDestacar(id: string): void {
  try { window.dispatchEvent(new CustomEvent(EVENTO, { detail: id })); } catch { /* */ }
}

/**
 * Deja el elemento centrado y lo CLAVA ahí mientras dura el resplandor.
 *
 * Aquí ya no se intenta adivinar quién mueve el scroll. Se probó a corregir
 * cada 500 ms y con retraso para dejar hidratar primero, y en las dos el salto
 * se alcanzaba a ver: la pantalla se iba arriba y regresaba.
 *
 * Así que se corrige CADA CUADRO. No importa si el brinco lo mete la
 * hidratación de Next, un re-render o el navegador restaurando la posición: se
 * deshace en los ~16 ms siguientes, que el ojo no alcanza a ver. Se usa salto
 * instantáneo (no `smooth`) justo por eso — una corrección animada es
 * exactamente lo que se veía como "sube y regresa".
 *
 * En cuanto la persona toca la rueda, la pantalla, el teclado o la barra de
 * scroll, se suelta el control: si ya decidió mirar otra cosa, pelearle el
 * scroll es peor que el problema.
 */
function seguirElemento(id: string): () => void {
  let sueltaElControl = false;
  const soltar = () => { sueltaElControl = true; diag("ancla SUELTA el control (input de la persona)"); };
  const opts = { passive: true, once: true } as const;
  window.addEventListener("wheel", soltar, opts);
  window.addEventListener("touchstart", soltar, opts);
  window.addEventListener("keydown", soltar, { once: true });
  window.addEventListener("mousedown", soltar, opts); // arrastrar la barra de scroll

  /** Dónde tendría que estar el scroll para que el elemento quede centrado. */
  const objetivo = (): number | null => {
    const el = document.querySelector(`[data-destacar-id="${CSS.escape(id)}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const y = window.scrollY + r.top - (window.innerHeight - r.height) / 2;
    return Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight));
  };

  let correcciones = 0;
  const corregir = () => {
    if (sueltaElControl) return;
    const y = objetivo();
    // Margen de 2 px: sin él, el redondeo del navegador provoca un `scrollTo`
    // en cada cuadro aunque ya esté en su lugar.
    if (y !== null && Math.abs(window.scrollY - y) > 2) {
      correcciones++;
      diag(`ancla corrige #${correcciones}: ${Math.round(window.scrollY)} → ${Math.round(y)}`);
      window.scrollTo(0, y);
    }
  };

  let raf = 0;
  const cuadro = () => { corregir(); raf = requestAnimationFrame(cuadro); };
  raf = requestAnimationFrame(cuadro);

  // Respaldo: `requestAnimationFrame` se congela cuando la pestaña no está
  // pintando (segundo plano, ventana tapada). Al volver al frente, el cuadro
  // podría tardar en reanudarse justo cuando la persona vuelve a mirar.
  const respaldo = setInterval(corregir, 40);

  return () => {
    cancelAnimationFrame(raf);
    clearInterval(respaldo);
    window.removeEventListener("wheel", soltar);
    window.removeEventListener("touchstart", soltar);
    window.removeEventListener("keydown", soltar);
    window.removeEventListener("mousedown", soltar);
  };
}

/**
 * Lee `?destacar=<id>` de la URL: es lo que hace que al llegar desde una
 * campanita o una notificación push, la pantalla abra ESA cosa y la resalte.
 *
 * La URL se limpia en cuanto se lee — si no, refrescar la página volvería a
 * prender el resplandor de algo que ya viste hace rato.
 *
 * El elemento destino solo necesita `data-destacar-id={id}` y la clase
 * `arido-destacado`; el scroll lo hace este hook.
 */
export function useDestacar(): string | null {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("destacar");
    if (!d) return;

    const u = new URL(window.location.href);
    u.searchParams.delete("destacar");
    window.history.replaceState({}, "", u.toString());

    diag(`?destacar leido: ${d}`);
    setId(d);
  }, []);

  // Segunda entrada: la campanita o el service worker avisando en caliente.
  useEffect(() => {
    const alAvisar = (e: Event) => {
      const nuevo = (e as CustomEvent<string>).detail;
      if (nuevo) setId(nuevo);
    };
    window.addEventListener(EVENTO, alAvisar);
    return () => window.removeEventListener(EVENTO, alAvisar);
  }, []);

  // Un solo lugar enciende el reloj, sigue el elemento y apaga: así no importa
  // por cuál de las dos entradas llegó.
  useEffect(() => {
    if (!id) return;
    resplandorHasta = Date.now() + DURACION;
    diag("ancla ARRANCA");
    const dejarDeSeguir = seguirElemento(id);
    const apagar = setTimeout(() => setId(null), DURACION);
    return () => {
      clearTimeout(apagar);
      diag("ancla TERMINA");
      dejarDeSeguir();
      resplandorHasta = 0;
    };
  }, [id]);

  return id;
}
