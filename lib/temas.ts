// Los temas de un EP/álbum y qué conceptos cotizados lleva cada uno.
//
// Módulo PURO: lo usan la cotización (en el navegador) y la venta y el
// proyecto (en el servidor), para que los dos lados repartan igual. La regla:
// la cantidad de un concepto cotizado es EN CUÁNTOS TEMAS VA ("Trombón ×2" =
// trombón en dos de los tres temas). De lo que lleve cada tema salen sus
// subtareas "Grabar X", su músico y la plantilla de REAPER.

import { inferirInstrumentos } from "@/lib/servicios";

export interface Tema {
  /** Vacío = "Canción N". */
  nombre: string;
  /** Labels de los conceptos cotizados que lleva este tema. */
  conceptos: string[];
}

export interface ItemCotizado { label: string; qty?: number }

export const MAX_TEMAS = 30;

export const nombreTema = (t: { nombre?: string | null } | null | undefined, i: number): string =>
  String(t?.nombre ?? "").trim() || `Canción ${i + 1}`;

const cantidad = (it: ItemCotizado) => Math.max(1, Math.trunc(Number(it.qty) || 1));
const limitar = (n: number) => Math.min(MAX_TEMAS, Math.max(1, Math.trunc(Number(n) || 1)));

/** Labels distintos de los conceptos, en el orden en que se cotizaron. */
export function etiquetasDe(items: ItemCotizado[]): string[] {
  return [...new Set(items.map((i) => String(i.label ?? "").trim()).filter(Boolean))];
}

/** Cantidad total de un label (por si el mismo concepto viene en dos renglones). */
const cantidadDe = (items: ItemCotizado[], label: string) =>
  items.filter((i) => String(i.label ?? "").trim() === label).reduce((a, i) => a + cantidad(i), 0);

/**
 * Reparto por defecto: un concepto con cantidad igual o mayor al número de
 * temas va en todos; si no, en los primeros `cantidad`.
 */
export function repartirPorCantidad(items: ItemCotizado[], n: number, nombres: string[] = []): Tema[] {
  const total = limitar(n);
  const labels = etiquetasDe(items);
  return Array.from({ length: total }, (_, i) => ({
    nombre: nombres[i] ?? "",
    conceptos: labels.filter((l) => i < Math.min(cantidadDe(items, l), total)),
  }));
}

/**
 * Ajusta los temas al número y a los conceptos actuales de la cotización.
 *
 * Conserva nombres y palomitas de los temas que quedan y quita los conceptos
 * que ya no están. Un concepto que no estaba en `itemsPrevios`, o cuya cantidad
 * cambió, se vuelve a repartir por defecto: si subiste el trombón de ×2 a ×3,
 * lo esperado es verlo en un tema más, no que se quede como estaba.
 *
 * `itemsPrevios` es lo que había antes del cambio. Hace falta: sin él no se
 * distingue un concepto nuevo de uno que despalomeaste en todos los temas a
 * propósito, y este último volvería a aparecer solo.
 */
export function ajustarTemas(temas: Tema[], n: number, items: ItemCotizado[], itemsPrevios: ItemCotizado[] = items): Tema[] {
  const total = limitar(n);
  const labels = etiquetasDe(items);
  const base = repartirPorCantidad(items, total);
  const antes = new Set(etiquetasDe(itemsPrevios));
  const redefinir = new Set(labels.filter((l) => !antes.has(l) || cantidadDe(itemsPrevios, l) !== cantidadDe(items, l)));
  return base.map((b, i) => {
    const t = temas[i];
    if (!t) return b;
    const lleva = (l: string) => (redefinir.has(l) ? b.conceptos.includes(l) : t.conceptos.includes(l));
    return { nombre: t.nombre, conceptos: labels.filter(lleva) };
  });
}

/** Palomea o despalomea un concepto en un tema, respetando el orden de la cotización. */
export function alternarConcepto(temas: Tema[], indice: number, label: string, items: ItemCotizado[]): Tema[] {
  const labels = etiquetasDe(items);
  return temas.map((t, i) => {
    if (i !== indice) return t;
    const tiene = t.conceptos.includes(label);
    const nuevos = tiene ? t.conceptos.filter((c) => c !== label) : [...t.conceptos, label];
    return { ...t, conceptos: labels.filter((l) => nuevos.includes(l)) };
  });
}

export interface Descuadre { concepto: string; cantidad: number; marcados: number }

/** Conceptos cuyas palomitas no cuadran con lo cotizado ("Trombón ×2" en 3 temas). */
export function descuadres(temas: Tema[], items: ItemCotizado[]): Descuadre[] {
  return etiquetasDe(items)
    .map((concepto) => ({
      concepto,
      cantidad: cantidadDe(items, concepto),
      marcados: temas.filter((t) => t.conceptos.includes(concepto)).length,
    }))
    .filter((d) => d.marcados !== Math.min(d.cantidad, temas.length));
}

/** Los instrumentos de un tema: lo que de sus conceptos se graba ("Trombón", los del paquete…). */
export const instrumentosDeTema = (t: Tema): string[] => inferirInstrumentos(t.conceptos);

/** Limpia lo que llega del navegador o de la base. null si no hay temas utilizables. */
export function limpiarTemas(raw: unknown): Tema[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.slice(0, MAX_TEMAS).map((t) => {
    const x = (t ?? {}) as { nombre?: unknown; conceptos?: unknown };
    const conceptos = Array.isArray(x.conceptos)
      ? [...new Set(x.conceptos.map((c) => String(c ?? "").trim().slice(0, 200)).filter(Boolean))].slice(0, 50)
      : [];
    return { nombre: String(x.nombre ?? "").trim().slice(0, 120), conceptos };
  });
  return out.length ? out : null;
}

/**
 * Los temas de una cotización: los guardados o, en una vieja (sin `temas`),
 * "Canción N" con el reparto por defecto de sus conceptos.
 */
export function temasDeCotizacion(cot: { temas?: unknown; num_canciones?: number | null; items?: ItemCotizado[] | null }): Tema[] {
  const guardados = limpiarTemas(cot.temas);
  if (guardados) return guardados;
  return repartirPorCantidad(Array.isArray(cot.items) ? cot.items : [], Number(cot.num_canciones) || 1);
}
