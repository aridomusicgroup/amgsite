import servicesRaw from "@/data/services.json";

/**
 * Infiere qué instrumentos lleva cada paquete de producción a partir de la info
 * que YA está explícita en `data/services.json` (campo `includes`), para
 * precargar el selector de instrumentos al crear una venta / convertir una
 * cotización. Sin dependencias de servidor: lo usan componentes cliente.
 */

const services = servicesRaw as unknown as {
  bases: { id: string; name: { es: string }; includes: { es: string[] } }[];
  extras: { id: string; label: { es: string } }[];
};

/** Extras contratables como instrumento suelto (chips seleccionables). */
export const EXTRAS_SERVICIOS: string[] = services.extras.map((e) => e.label.es);

// Lo que NO es instrumento dentro de `includes` (ya son tareas propias de la plantilla).
const NO_INSTRUMENTO = /mezcla|master|producci[oó]n personalizada|plataforma/i;

/** "Armonía (guitarra o bajoquinto)" → "Armonía" · "Bass o bajoloche" → "Bass" */
function limpiar(s: string): string {
  return s.replace(/\(.*?\)/g, "").split(/\s+o\s+/i)[0].trim();
}

/** TODO lo que incluye un paquete (instrumentos + mezcla/master), tal cual services.json. */
export function incluyeDePaquete(texto: string): string[] {
  const t = (texto || "").toLowerCase();
  const base = services.bases.find((b) => b.name.es && t.includes(b.name.es.toLowerCase()));
  return base ? base.includes.es : [];
}

/** Instrumentos que incluye un paquete, buscándolo por nombre dentro del texto. */
export function instrumentosDePaquete(texto: string): string[] {
  const t = (texto || "").toLowerCase();
  const base = services.bases.find((b) => b.name.es && t.includes(b.name.es.toLowerCase()));
  if (!base) return [];
  return base.includes.es.filter((x) => !NO_INSTRUMENTO.test(x)).map(limpiar).filter(Boolean);
}

/**
 * Infiere los instrumentos a partir de los conceptos de una cotización/venta.
 * Suma los del paquete detectado + los extras sueltos que aparezcan.
 */
export function inferirInstrumentos(conceptos: string[]): string[] {
  const out = new Set<string>();
  for (const c of conceptos) {
    for (const i of instrumentosDePaquete(c)) out.add(i);
    const ex = EXTRAS_SERVICIOS.find((e) => (c || "").toLowerCase().includes(e.toLowerCase()));
    if (ex) out.add(ex);
  }
  return [...out];
}
