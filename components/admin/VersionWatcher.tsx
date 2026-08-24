"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, X, Sparkles } from "lucide-react";

const IDLE_MS = 15 * 60 * 1000;   // 15 min sin actividad → revisa si hay versión nueva
const CHECK_COOLDOWN = 60 * 1000; // no revisar más de 1 vez/min

/**
 * Vigila si salió un deploy nuevo mientras el panel estuvo mucho tiempo inactivo
 * (o al volver a la pestaña). Si lo hay, muestra una alerta chica abajo a la
 * derecha con un botón para refrescar. Honesto: solo aparece si de verdad cambió
 * la versión del sitio (compara /api/version contra la que cargó).
 */
export function VersionWatcher() {
  const [nueva, setNueva] = useState(false);
  const baseline = useRef<string | null>(null);
  const lastActivity = useRef(Date.now());
  const lastCheck = useRef(0);
  const shown = useRef(false);

  useEffect(() => {
    let cancel = false;

    // Versión que cargó esta pestaña (línea base).
    fetch("/api/version", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancel) baseline.current = d?.v ?? null; })
      .catch(() => {});

    const marcarActividad = () => { lastActivity.current = Date.now(); };
    const eventos = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    eventos.forEach((e) => window.addEventListener(e, marcarActividad, { passive: true }));

    const revisar = async () => {
      if (shown.current || !baseline.current) return;
      const now = Date.now();
      if (now - lastCheck.current < CHECK_COOLDOWN) return;
      lastCheck.current = now;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const d = await r.json();
        if (d?.v && d.v !== baseline.current) { shown.current = true; setNueva(true); }
      } catch { /* red caída: reintenta luego */ }
    };

    // Cada minuto: si lleva rato inactivo y la pestaña está visible, revisa.
    const iv = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastActivity.current > IDLE_MS) revisar();
    }, 60 * 1000);

    // Al volver a la pestaña tras estar oculta, revisa de una.
    const onVis = () => { if (!document.hidden) revisar(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancel = true;
      eventos.forEach((e) => window.removeEventListener(e, marcarActividad));
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(iv);
    };
  }, []);

  if (!nueva) return null;

  return (
    <div className="fixed bottom-24 md:bottom-4 right-4 z-[70] max-w-[calc(100vw-2rem)] w-72 rounded-2xl border border-lgb-red/30 bg-lgb-dark/95 backdrop-blur shadow-2xl shadow-black/50 p-3.5 animate-in">
      <button
        onClick={() => setNueva(false)}
        className="absolute top-2 right-2 text-white/30 hover:text-white p-0.5"
        title="Cerrar"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-2.5">
        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-lgb-red/15 text-lgb-red shrink-0">
          <Sparkles size={16} />
        </span>
        <div className="min-w-0 pr-3">
          <p className="text-sm font-medium text-white leading-tight">Hay una versión nueva del sitio</p>
          <p className="text-white/45 text-xs mt-0.5">Actualiza para tener los últimos cambios.</p>
        </div>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="mt-3 w-full flex items-center justify-center gap-1.5 bg-lgb-red hover:bg-red-700 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors"
      >
        <RefreshCw size={14} /> Actualizar ahora
      </button>
      <style>{`
        .animate-in { animation: vw-in .35s cubic-bezier(.16,1,.3,1); }
        @keyframes vw-in { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform:none; } }
      `}</style>
    </div>
  );
}
