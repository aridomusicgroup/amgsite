"use client";
import { useSyncExternalStore } from "react";

/**
 * La hora actual redondeada al minuto, como fuente externa: el componente se
 * vuelve a pintar solo cuando cambia el minuto (p. ej. para que aparezca el
 * botón de “Entrar a la sesión” sin recargar). En el servidor devuelve null.
 */
const MINUTO = 60_000;
const suscribir = (cb: () => void) => {
  const id = setInterval(cb, 15_000);
  return () => clearInterval(id);
};
const ahora = () => Math.floor(Date.now() / MINUTO) * MINUTO;

export function useAhora(): number | null {
  return useSyncExternalStore(suscribir, ahora, () => null);
}
