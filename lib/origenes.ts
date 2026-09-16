// De dónde llegó un cliente. Módulo puro: lo usan formularios, rutas y el tablero.
//
// Es DISTINTO de dónde se cerró la venta (`ventas.canal`, casi siempre
// WhatsApp). Un cliente que vio un reel y luego escribió por WhatsApp llegó por
// Instagram: contarlo como WhatsApp es justo lo que escondía cuánto vende
// Instagram.

export const ORIGENES = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "facebook", label: "Facebook" },
  { id: "beatstars", label: "BeatStars" },
  { id: "sitio", label: "Sitio web / Google" },
  { id: "recomendacion", label: "Recomendación" },
  { id: "whatsapp", label: "WhatsApp directo" },
  { id: "otro", label: "Otro" },
] as const;

export type Origen = (typeof ORIGENES)[number]["id"];

export const ORIGEN_LABEL: Record<string, string> = Object.fromEntries(ORIGENES.map((o) => [o.id, o.label]));

/** Valor válido del catálogo, o null. */
export function normalizarOrigen(v: unknown): Origen | null {
  const s = String(v ?? "").trim().toLowerCase();
  return (ORIGENES.find((o) => o.id === s)?.id as Origen | undefined) ?? null;
}

/** Instagram se liga a un reel sincronizado; estos, a un link pegado a mano. */
export const ORIGENES_CON_ENLACE: readonly string[] = ["tiktok", "youtube", "facebook"];

/**
 * Canales con enlace rastreable (aridomusicgroup.com/ir/<canal>): se ponen en la
 * bio de cada perfil. Cada clic se cuenta y abre WhatsApp con un mensaje que ya
 * dice de dónde viene la persona.
 */
export const CANALES_ENLACE: readonly string[] = ["instagram", "tiktok", "youtube", "facebook", "beatstars"];

/** Un link de video válido (sólo http/https), recortado. null si no sirve. */
export function limpiarEnlace(v: unknown): string | null {
  const s = String(v ?? "").trim().slice(0, 500);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
