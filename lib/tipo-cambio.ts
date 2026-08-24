// Moneda y tipo de cambio, compartidos por cotizaciones, contratos y ventas.
//
// Todo el panel reporta en PESOS (Dashboard, Finanzas, LTV del CRM). Cuando algo
// se cotiza en dólares hay que guardar las dos cosas: el monto en su moneda
// original —que es lo que el cliente ve y firma— y su equivalente en pesos con
// el tipo de cambio que se usó. Sin guardar el tipo de cambio, el número en
// pesos deja de ser auditable: nadie sabría de dónde salió.
//
// Módulo PURO: lo usan los formularios (navegador) y las rutas (servidor).

export const MONEDAS = ["MXN", "USD"] as const;
export type Moneda = (typeof MONEDAS)[number];

/**
 * Último recurso si no hay ventas de dónde promediar.
 *
 * No es un número inventado: es la media de los tipos de cambio que el equipo
 * ha capturado a mano en sus ventas reales (16.49 – 17.05).
 */
export const TIPO_CAMBIO_FALLBACK = 16.9;

export const esExtranjera = (moneda: string | null | undefined): boolean =>
  String(moneda || "MXN").toUpperCase() !== "MXN";

/**
 * Convierte a pesos. En MXN devuelve el mismo monto (el tipo de cambio se
 * ignora a propósito: si alguien deja 17 escrito y cambia la moneda a pesos,
 * multiplicar sería un error silencioso de 17x).
 */
export function aMxn(monto: number, moneda: string | null | undefined, tipoCambio: number): number {
  const m = Number(monto) || 0;
  if (!esExtranjera(moneda)) return redondea(m);
  const tc = Number(tipoCambio) || 0;
  return tc > 0 ? redondea(m * tc) : 0;
}

const redondea = (n: number) => Math.round(n * 100) / 100;

/**
 * Factor para reexpresar los MISMOS montos en otra moneda.
 *
 * Es lo que pasa al cambiar el selector: si cotizaste 6,000 pesos y eliges USD,
 * los conceptos y el total se vuelven a escribir en dólares (÷ tipo de cambio),
 * no se multiplican. El trabajo cotizado es el mismo; lo único que cambia es en
 * qué moneda se le presenta al cliente.
 *
 * Devuelve `null` cuando no se puede convertir (falta el tipo de cambio), para
 * que quien llama no reescriba los precios con basura.
 */
export function factorConversion(de: string, a: string, tipoCambio: number): number | null {
  const tc = Number(tipoCambio) || 0;
  if (de === a) return null;
  if (tc <= 0) return null;
  if (!esExtranjera(de) && esExtranjera(a)) return 1 / tc;  // pesos  → dólares
  if (esExtranjera(de) && !esExtranjera(a)) return tc;      // dólares → pesos
  return null;
}

/** Reexpresa un monto en la otra moneda, a 2 decimales. */
export const convertir = (monto: number, factor: number): number =>
  redondea((Number(monto) || 0) * factor);

/** "$1,234.50 USD" */
export function fmtMoneda(monto: number, moneda: string | null | undefined): string {
  const m = String(moneda || "MXN").toUpperCase();
  return `$${(Number(monto) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${m}`;
}

/** Valida lo que se escribió en el campo de tipo de cambio. */
export function validarTipoCambio(moneda: string, tipoCambio: number): string | null {
  if (!esExtranjera(moneda)) return null;
  if (!(tipoCambio > 0)) return "Escribe el tipo de cambio para convertir a pesos.";
  if (tipoCambio > 100) return "Ese tipo de cambio se ve mal (¿pusiste el total por error?).";
  return null;
}
