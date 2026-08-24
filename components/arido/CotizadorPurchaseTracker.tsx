"use client";
import { useEffect } from "react";
import { track } from "@/lib/track";

interface Props {
  sessionId: string;
  total: number | null;
  resumen: string;
}

/**
 * Dispara el evento `cotizador_pagado` (fondo del embudo del cotizador) al
 * cargar la página de gracias, tras el redirect de Stripe. Idempotente por
 * session_id (no cuenta doble en refresh) — mismo patrón que PurchaseTracker
 * (tienda de beats), pero como evento propio para no mezclar los dos embudos.
 */
export function CotizadorPurchaseTracker({ sessionId, total, resumen }: Props) {
  useEffect(() => {
    if (!sessionId) return;
    const key = `arido-cotizador-pagado-${sessionId}`;
    try {
      if (localStorage.getItem(key)) return; // ya contada
      localStorage.setItem(key, "1");
    } catch {
      /* sin localStorage: se cuenta igual */
    }
    track("cotizador_pagado", {
      session_id: sessionId,
      valor: total,
      moneda: "MXN",
      resumen,
    });
  }, [sessionId, total, resumen]);

  return null;
}
