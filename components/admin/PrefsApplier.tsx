"use client";
import { useEffect } from "react";

// El tamaño de la raíz escala todo el panel (las clases text-* de Tailwind son rem).
const SIZES: Record<string, string> = { sm: "14px", md: "16px", lg: "18px" };

export function PrefsApplier({ fontSize }: { fontSize: string }) {
  useEffect(() => {
    const prev = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = SIZES[fontSize] ?? "16px";
    return () => { document.documentElement.style.fontSize = prev; };
  }, [fontSize]);
  return null;
}
