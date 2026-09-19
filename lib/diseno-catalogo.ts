import "server-only";
import raw from "@/data/diseno.json";
import { sinCosto, type EjemploDiseno, type ServicioDiseno, type ServicioDisenoPublico } from "@/lib/diseno";

/**
 * El catálogo de diseño visual, CON el costo del diseñador.
 *
 * server-only a propósito: `data/diseno.json` trae lo que cobra el diseñador y
 * eso no puede terminar en el JS público (la landing se vende con marca ARIDO;
 * con su lista a la vista, el artista le escribe directo). La landing recibe
 * `catalogoDisenoPublico()`; el panel, que va con sesión, el completo.
 */

/** A quién se le paga el diseño. Mismo nombre que su fila en `musicos`. */
export const PROVEEDOR_DISENO = "Julio Guerrero";

const CATALOGO: ServicioDiseno[] = (raw.servicios as unknown as ServicioDiseno[]).filter(
  (s) => s.id && s.nombre?.es && Number(s.precio) > 0 && Number(s.costo) >= 0,
);

export function catalogoDiseno(): ServicioDiseno[] {
  return CATALOGO;
}

export function catalogoDisenoPublico(): ServicioDisenoPublico[] {
  return sinCosto(CATALOGO);
}

/** Muestras de trabajo para la landing (imágenes en /public). Vacío = no se muestra la sección. */
export function ejemplosDiseno(): EjemploDiseno[] {
  const lista = (raw as { ejemplos?: unknown }).ejemplos;
  return (Array.isArray(lista) ? lista : [])
    .filter((e): e is EjemploDiseno => !!e && typeof e.src === "string" && e.src.startsWith("/"))
    .map((e) => ({ src: e.src, alt: String(e.alt || "Diseño para artista") }));
}
