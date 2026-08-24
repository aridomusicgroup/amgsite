"use client";
import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

/** Captura silenciosa de origen del visitante (first-touch) */
export function Attribution() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
