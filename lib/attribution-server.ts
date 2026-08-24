export interface Attrib {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referrer?: string | null;
  landing?: string | null;
}

/** Convierte la atribución del cliente en metadata segura para Stripe */
export function attribMetadata(
  attrib: Attrib | null | undefined
): Record<string, string> {
  if (!attrib || typeof attrib !== "object") return {};
  const out: Record<string, string> = {};
  for (const k of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "referrer",
    "landing",
  ] as const) {
    const v = attrib[k];
    if (typeof v === "string" && v) out[k] = v.slice(0, 200);
  }
  return out;
}
