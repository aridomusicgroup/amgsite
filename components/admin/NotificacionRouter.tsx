"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { avisarDestacar } from "@/lib/useDestacar";

/**
 * Plan B del service worker: cuando `client.navigate()` no está disponible o lo
 * bloquea el navegador, el SW le manda un mensaje a la página y aquí se navega
 * con el router de Next.
 *
 * Sin esto, tocar una notificación con el panel ya abierto solo traía la
 * ventana al frente — que es exactamente lo que pasaba antes.
 */
export function NotificacionRouter() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;

    const alMensaje = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null;
      if (!d || d.type !== "arido-navegar" || !d.url) return;
      try {
        const u = new URL(d.url, window.location.origin);
        // Solo se navega dentro del propio panel: un mensaje con una URL de
        // fuera no debe poder sacar a nadie de aquí.
        if (u.origin !== window.location.origin) return;
        router.push(u.pathname + u.search);
        // Navegar a la MISMA ruta no vuelve a montar la pantalla, así que el
        // resplandor se avisa aparte.
        const destacar = u.searchParams.get("destacar");
        if (destacar) avisarDestacar(destacar);
      } catch { /* URL inválida: se ignora */ }
    };

    navigator.serviceWorker.addEventListener("message", alMensaje);
    return () => navigator.serviceWorker.removeEventListener("message", alMensaje);
  }, [router]);

  return null;
}
