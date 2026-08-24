"use client";

/**
 * Atribución first-touch: guarda de dónde llegó el visitante la primera vez
 * (UTM, referrer, página de aterrizaje) y lo manda con cada checkout.
 */

export interface Attribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing: string | null;
}

const KEY = "arido-attrib";

/** Deducir la red social a partir del referrer cuando no hay UTM */
function sourceFromReferrer(ref: string): string | null {
  if (/instagram\.com|l\.instagram/.test(ref)) return "instagram";
  if (/tiktok\.com/.test(ref)) return "tiktok";
  if (/facebook\.com|fb\.com|l\.facebook/.test(ref)) return "facebook";
  if (/youtube\.com|youtu\.be/.test(ref)) return "youtube";
  if (/beatstars\.com/.test(ref)) return "beatstars";
  if (/google\./.test(ref)) return "google";
  if (/whatsapp/.test(ref)) return "whatsapp";
  return null;
}

export function captureAttribution() {
  try {
    if (localStorage.getItem(KEY)) return; // first-touch: solo la primera visita
    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer || null;
    const sameSite = referrer?.includes("aridomusicgroup.com");
    const attrib: Attribution = {
      utm_source:
        params.get("utm_source") ??
        (referrer && !sameSite ? sourceFromReferrer(referrer) : null) ??
        (referrer && !sameSite ? null : "directo"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      referrer: sameSite ? null : referrer,
      landing: window.location.pathname,
    };
    localStorage.setItem(KEY, JSON.stringify(attrib));
  } catch {
    /* localStorage no disponible */
  }
}

export function getAttribution(): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}
