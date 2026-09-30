// Validación de lo que llega del panel para el catálogo de diseño visual.
// Módulo PURO (sin alias ni servidor) para probarlo con `npm test`.

export const PRECIO_MAX_DISENO = 200_000;

export interface FilaDiseno {
  id: string;
  activo: boolean;
  datos: Record<string, unknown>;
}

export type ResultadoDiseno = { ok: true; fila: FilaDiseno } | { ok: false; error: string };

const txt = (v: unknown, max: number): string => String(v ?? "").trim().slice(0, max);
const lista = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map((x) => txt(x, 140)).filter(Boolean).slice(0, 12);

function entero(v: unknown, campo: string, min: number): number | string {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return `${campo} debe ser un número entero, en pesos.`;
  if (n < min || n > PRECIO_MAX_DISENO) return `${campo} debe estar entre ${min} y ${PRECIO_MAX_DISENO.toLocaleString("es-MX")}.`;
  return n;
}

/**
 * Valida la edición de un servicio de diseño ya existente.
 *
 * Lo que NO se edita aquí (grupo, unidad, de qué se compone un paquete) se
 * conserva de la fila actual: el panel sólo toca precio, costo, textos y
 * visibilidad. El id nunca cambia.
 *
 * `puedeVerCosto`: quien no es admin no ve ni cambia lo que se le paga al
 * diseñador; su costo se conserva tal cual estaba.
 */
export function validarDiseno(
  b: Record<string, unknown>,
  actual: FilaDiseno,
  puedeVerCosto: boolean,
): ResultadoDiseno {
  const nom = (b.nombre ?? {}) as { es?: unknown; en?: unknown };
  const nombreEs = txt(nom.es, 120);
  if (!nombreEs) return { ok: false, error: "Falta el nombre en español." };

  const precio = entero(b.precio, "El precio", 1);
  if (typeof precio === "string") return { ok: false, error: precio };

  let costo = Number(actual.datos.costo) || 0;
  if (puedeVerCosto) {
    const c = entero(b.costo, "El costo", 0);
    if (typeof c === "string") return { ok: false, error: c };
    costo = c;
  }
  if (costo > precio) {
    return { ok: false, error: "El costo del diseñador no puede ser mayor que el precio al cliente (revisa que no sea un error de captura)." };
  }

  const inc = (b.incluye ?? {}) as { es?: unknown; en?: unknown };
  const incEs = lista(inc.es);
  if (!incEs.length) return { ok: false, error: "Escribe al menos una cosa que incluye." };
  const incEn = lista(inc.en);

  const datos: Record<string, unknown> = {
    ...actual.datos,
    nombre: { es: nombreEs, en: txt(nom.en, 120) || nombreEs },
    incluye: { es: incEs, en: incEn.length === incEs.length ? incEn : incEs },
    precio,
    costo,
  };
  // Marcas opcionales: sólo existen cuando están prendidas.
  for (const k of ["desde", "destacado"] as const) {
    if (b[k] === true) datos[k] = true;
    else delete datos[k];
  }

  return { ok: true, fila: { id: actual.id, activo: b.activo === undefined ? actual.activo : b.activo === true, datos } };
}
