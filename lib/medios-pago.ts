// Medios de pago con un solo nombre cada uno, para que Finanzas y el reporte
// del contador puedan agruparlos. Antes era texto libre ("ZELLE", "Zelle",
// "Transferencia ", "PAYPAL"…). Misma regla que normalizar_medio_pago() en SQL.

export const MEDIOS_PAGO = ["Transferencia", "Zelle", "PayPal", "Stripe", "BeatStars", "Efectivo", "Otro"] as const;

/** Opciones del select; si el valor guardado es uno viejo fuera de la lista, se agrega para no perderlo. */
export function opcionesMedio(actual?: string | null): string[] {
  const lista: string[] = [...MEDIOS_PAGO];
  return actual && !lista.includes(actual) ? [...lista, actual] : lista;
}

export function normalizarMedio(t: string | null | undefined): string | null {
  const v = (t ?? "").trim();
  if (!v) return null;
  const l = v.toLowerCase();
  if (l === "zelle") return "Zelle";
  if (l.startsWith("transferencia")) return "Transferencia";
  if (l === "paypal") return "PayPal";
  if (l === "stripe") return "Stripe";
  if (l === "beatstars") return "BeatStars";
  if (l === "efectivo") return "Efectivo";
  if (l === "otro") return "Otro";
  return v;
}
