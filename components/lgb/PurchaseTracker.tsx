"use client";
import { useEffect } from "react";
import { track } from "@/lib/track";

interface Props {
  sessionId: string;
  total: number;
  beats: string[];
  licencias: string[];
}

/**
 * Dispara el evento `compra` (fondo del embudo) al cargar la página de gracias,
 * tras el redirect de Stripe. Idempotente por session_id (no cuenta doble en
 * refresh). El mismo dominio conserva el distinct_id → conecta con el embudo.
 */
export function PurchaseTracker({ sessionId, total, beats, licencias }: Props) {
  useEffect(() => {
    if (!sessionId) return;
    const key = `arido-compra-${sessionId}`;
    try {
      if (localStorage.getItem(key)) return; // ya contada
      localStorage.setItem(key, "1");
    } catch {
      /* sin localStorage: se cuenta igual */
    }
    track("compra", {
      session_id: sessionId,
      valor: total,
      moneda: "USD",
      n_items: beats.length,
      beats,
      licencias,
    });
  }, [sessionId, total, beats, licencias]);

  return null;
}
