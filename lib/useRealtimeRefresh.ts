"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { resplandorActivo } from "@/lib/useDestacar";
import { diag } from "@/lib/diag";

/**
 * Suscribe la página a los cambios de las tablas dadas (Supabase Realtime) y la
 * refresca al instante cuando alguien del equipo cambia algo. Debounce para
 * agrupar ráfagas; respaldo por sondeo si Realtime se cae. No refresca si estás
 * escribiendo o si la pestaña está en segundo plano.
 *
 * Requiere que cada tabla esté publicada en Realtime y tenga la política de
 * lectura para staff (ver supabase-realtime*.sql).
 */
export function useRealtimeRefresh(channel: string, tables: readonly string[]) {
  const router = useRouter();
  const key = tables.join(",");
  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    let t: ReturnType<typeof setTimeout> | null = null;
    const puedeRefrescar = () => {
      if (document.visibilityState !== "visible") return false;
      // Acabas de llegar desde una notificación y te estamos enseñando algo:
      // un refresco aquí re-renderiza el árbol y el navegador pierde el scroll,
      // así que la ventana se iría sola hasta arriba. Espera a que se apague.
      if (resplandorActivo()) return false;
      const tag = document.activeElement?.tagName;
      return tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT";
    };
    // Si ahorita no se puede (estás escribiendo, o hay un resplandor en curso),
    // se reintenta en vez de tirar el cambio: si no, lo que hizo el equipo no
    // aparecería hasta el sondeo de 60 s.
    const bump = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        if (puedeRefrescar()) { diag("router.refresh() por CAMBIO en tiempo real"); router.refresh(); }
        else bump();
      }, 400);
    };

    let cleanupRt: (() => void) | null = null;
    try {
      const supa = createAuthClient();
      let ch = supa.channel(channel);
      for (const table of list) {
        ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, bump);
      }
      ch.subscribe();
      cleanupRt = () => { try { supa.removeChannel(ch); } catch { /* noop */ } };
    } catch { /* sin tiempo real; queda el respaldo */ }

    const poll = setInterval(() => {
      if (puedeRefrescar()) { diag("router.refresh() por SONDEO de 60 s"); router.refresh(); }
    }, 60000);

    return () => { if (t) clearTimeout(t); clearInterval(poll); if (cleanupRt) cleanupRt(); };
  }, [router, channel, key]);
}
