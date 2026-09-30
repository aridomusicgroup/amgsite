import servicesRaw from "@/data/services.json";

/**
 * El catálogo del cotizador (paquetes, instrumentos extra, servicios de estudio)
 * y lo que se deduce de él. Sin dependencias de servidor: lo usan componentes
 * cliente.
 *
 * La fuente de verdad es la tabla `servicios_catalogo` (se edita en
 * /admin/servicios) y la lee `getCatalogo()` de `servicios-catalogo.ts`.
 * `data/services.json` queda de SEMILLA y de respaldo: si la tabla no existe o
 * falla, todo sigue funcionando con lo que trae el archivo.
 *
 * Las funciones de abajo reciben el catálogo como argumento (por defecto, la
 * semilla). Quien las llama con datos reales pasa el catálogo vivo — si no, un
 * instrumento nuevo no se reconocería y su venta se quedaría sin tarea.
 */

export type L = { es: string; en: string };

export interface Opcion { id: string; label: L }
export interface Eleccion { id: string; label: L; options: Opcion[] }

export interface Paquete {
  id: string;
  name: L;
  tagline: L;
  price: number;
  includes: { es: string[]; en: string[] };
  /** Ids de extras que ya trae el paquete (no se cobran aparte). */
  includedExtras: string[];
  choices: Eleccion[];
  activo: boolean;
}

export interface Extra {
  id: string;
  label: L;
  price: number;
  /** false = se vende pero NO genera tarea "Grabar X" (ej. un servicio sin grabación). */
  graba: boolean;
  activo: boolean;
}

export interface ServicioEstudio {
  id: string;
  label: L;
  description: L;
  price: number;
  activo: boolean;
}

export interface Catalogo {
  currency: string;
  bases: Paquete[];
  extras: Extra[];
  studio: ServicioEstudio[];
}

/** El catálogo del archivo, normalizado (todo activo). Es la semilla y el respaldo. */
export const CATALOGO_SEMILLA: Catalogo = (() => {
  const raw = servicesRaw as unknown as {
    currency?: string;
    bases: Omit<Paquete, "activo">[];
    extras: Omit<Extra, "activo" | "graba">[];
    studio: Omit<ServicioEstudio, "activo">[];
  };
  return {
    currency: raw.currency ?? "MXN",
    bases: raw.bases.map((b) => ({ ...b, activo: true })),
    extras: raw.extras.map((e) => ({ ...e, graba: true, activo: true })),
    studio: raw.studio.map((s) => ({ ...s, activo: true })),
  };
})();

/** Sólo lo que se le muestra al cliente en la web: nada oculto. */
export function catalogoPublico(cat: Catalogo): Catalogo {
  return {
    ...cat,
    bases: cat.bases.filter((b) => b.activo),
    extras: cat.extras.filter((e) => e.activo),
    studio: cat.studio.filter((s) => s.activo),
  };
}

/** Extras contratables como instrumento suelto (chips seleccionables). */
export const extrasServicios = (cat: Catalogo = CATALOGO_SEMILLA): string[] =>
  cat.extras.filter((e) => e.activo).map((e) => e.label.es);

/**
 * Los paquetes del catálogo, con su id.
 *
 * El id es la llave con la que se liga un paquete a su plantilla de REAPER:
 * `proyectos.tipo` no sirve para eso porque Tumbes, Alucines y Empedes son tres
 * instrumentaciones distintas y los tres caen en 'grabacion'.
 */
export const paquetes = (cat: Catalogo = CATALOGO_SEMILLA): { id: string; nombre: string }[] =>
  cat.bases.map((b) => ({ id: b.id, nombre: b.name.es }));

// Lo que NO es instrumento dentro de `includes` (ya son tareas propias de la plantilla).
const NO_INSTRUMENTO = /mezcla|master|producci[oó]n personalizada|plataforma/i;

/** "Armonía (guitarra o bajoquinto)" → "Armonía" · "Bass o bajoloche" → "Bass" */
function limpiar(s: string): string {
  return s.replace(/\(.*?\)/g, "").split(/\s+o\s+/i)[0].trim();
}

/**
 * El paquete cuyo nombre aparece en el texto. Incluye los OCULTOS a propósito:
 * una cotización vieja de un paquete que ya no se vende sigue debiendo
 * reconocerse. Si dos nombres coinciden gana el más largo ("Beat Urbano Plus"
 * antes que "Beat Urbano").
 */
function paqueteEnTexto(texto: string, cat: Catalogo): Paquete | undefined {
  const t = (texto || "").toLowerCase();
  return cat.bases
    .filter((b) => b.name.es && t.includes(b.name.es.toLowerCase()))
    .sort((a, b) => b.name.es.length - a.name.es.length)[0];
}

/** TODO lo que incluye un paquete (instrumentos + mezcla/master), tal cual el catálogo. */
export function incluyeDePaquete(texto: string, cat: Catalogo = CATALOGO_SEMILLA): string[] {
  return paqueteEnTexto(texto, cat)?.includes.es ?? [];
}

/** Instrumentos que incluye un paquete, buscándolo por nombre dentro del texto. */
export function instrumentosDePaquete(texto: string, cat: Catalogo = CATALOGO_SEMILLA): string[] {
  const base = paqueteEnTexto(texto, cat);
  if (!base) return [];
  return base.includes.es.filter((x) => !NO_INSTRUMENTO.test(x)).map(limpiar).filter(Boolean);
}

/**
 * Infiere los instrumentos a partir de los conceptos de una cotización/venta.
 * Suma los del paquete detectado + los extras sueltos que aparezcan. Un extra
 * marcado `graba: false` se vende pero no pide grabación. También cuentan los
 * extras ocultos: la cotización es anterior a que se ocultaran.
 */
export function inferirInstrumentos(conceptos: string[], cat: Catalogo = CATALOGO_SEMILLA): string[] {
  const out = new Set<string>();
  const grabables = cat.extras.filter((e) => e.graba).map((e) => e.label.es);
  for (const c of conceptos) {
    for (const i of instrumentosDePaquete(c, cat)) out.add(i);
    const t = (c || "").toLowerCase();
    const ex = grabables.find((e) => t.includes(e.toLowerCase()));
    if (ex) out.add(ex);
  }
  return [...out];
}

/**
 * El catálogo aplanado para el selector rápido del panel (cotizaciones).
 * `soloActivos`: el selector no ofrece lo oculto; pero para reconocer conceptos
 * de cotizaciones viejas ("¿esto venía del catálogo?") se usa la lista completa.
 */
export function catalogoLista(
  cat: Catalogo = CATALOGO_SEMILLA,
  soloActivos = true,
): { group: string; label: string; price: number }[] {
  const ok = (x: { activo: boolean }) => !soloActivos || x.activo;
  return [
    ...cat.bases.filter((b) => ok(b) && b.price > 0).map((b) => ({ group: "Paquetes", label: b.name.es, price: b.price })),
    ...cat.extras.filter(ok).map((e) => ({ group: "Instrumentos", label: e.label.es, price: e.price })),
    ...cat.studio.filter(ok).map((s) => ({ group: "Estudio", label: s.label.es, price: s.price })),
  ];
}
