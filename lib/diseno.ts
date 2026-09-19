/**
 * Diseño visual para artistas (portada, canvas, visualizer, lyric video,
 * logo, branding, redes) — lógica PURA.
 *
 * El trabajo lo hace un diseñador externo: ARIDO cobra su precio (~+50% sobre
 * la lista del diseñador) y le paga su costo completo. Aquí vive la cuenta de
 * cuánto se le debe y cuánto nos queda; el catálogo con los costos se lee en
 * `lib/diseno-catalogo.ts` (server-only) y se pasa como argumento, para que
 * este módulo se pueda usar en el navegador sin arrastrar los costos.
 *
 * Sin imports a propósito: lo prueba `lib/diseno.test.mjs` con `node --test`.
 */

export type GrupoDiseno = "paquete" | "servicio" | "adicional";

export interface Bilingue<T> {
  es: T;
  en: T;
}

export interface ComponenteDiseno {
  id: string;
  cantidad?: number;
}

/** Lo que puede ver cualquiera: la landing lo recibe así. */
export interface ServicioDisenoPublico {
  id: string;
  grupo: GrupoDiseno;
  nombre: Bilingue<string>;
  incluye: Bilingue<string[]>;
  /** MXN, lo que paga el cliente. */
  precio: number;
  /** "pieza": el precio es por unidad. */
  unidad?: Bilingue<string>;
  /** El precio es "desde" (piezas más complejas se cotizan aparte). */
  desde?: boolean;
  /** De qué se compone un paquete — sirve para decir cuánto se ahorra. */
  componentes?: ComponenteDiseno[];
  destacado?: boolean;
}

/** Con el costo del diseñador. Sólo servidor y panel con sesión. */
export interface ServicioDiseno extends ServicioDisenoPublico {
  /** MXN, lo que se le paga al diseñador. */
  costo: number;
}

/** Una muestra de trabajo para la landing (imagen en /public). */
export interface EjemploDiseno {
  src: string;
  alt: string;
}

/** Instrumento con el que el diseñador vive en `musicos` y en `pagos_musico`. */
export const INSTRUMENTO_DISENO = "Diseño";

const redondea = (n: number): number => Math.round(n * 100) / 100;

const normalizar = (s: string): string =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** El catálogo sin el costo del diseñador — lo único que puede salir al público. */
export function sinCosto(catalogo: readonly ServicioDiseno[]): ServicioDisenoPublico[] {
  return catalogo.map(({ costo: _costo, ...resto }) => {
    void _costo;
    return resto;
  });
}

/**
 * El servicio del catálogo al que se refiere un concepto de cotización.
 *
 * Por nombre, igual que el resto del panel (`incluyeDePaquete`, `enCatalogo`):
 * los conceptos se guardan como texto. Gana el nombre MÁS LARGO que aparezca
 * dentro del concepto, para que "Portada + Canvas de Spotify" no se lea como
 * "Canvas de Spotify", y para aguantar que alguien le agregue el nombre del
 * tema ("Portada (Cover Art) — Alto Nivel").
 */
export function servicioDeLabel<T extends ServicioDisenoPublico>(label: string, catalogo: readonly T[]): T | null {
  const t = normalizar(label);
  if (!t) return null;
  let mejor: T | null = null;
  let largo = 0;
  for (const s of catalogo) {
    for (const nombre of [s.nombre.es, s.nombre.en]) {
      const n = normalizar(nombre);
      if (n && n.length > largo && t.includes(n)) {
        mejor = s;
        largo = n.length;
      }
    }
  }
  return mejor;
}

/** Lo que incluye un concepto de diseño (vacío si no es del catálogo). */
export function incluyeDeDiseno(label: string, catalogo: readonly ServicioDisenoPublico[]): string[] {
  return servicioDeLabel(label, catalogo)?.incluye.es ?? [];
}

/**
 * Cuánto se le paga al diseñador por estos conceptos (MXN).
 *
 * Es una SUGERENCIA: en el panel se puede corregir (piezas de redes más
 * complejas, un precio especial). Los conceptos que no son de diseño cuestan 0.
 */
export function costoSugerido(
  items: readonly { label: string; qty: number }[],
  catalogo: readonly ServicioDiseno[],
): number {
  let total = 0;
  for (const i of items) {
    const s = servicioDeLabel(i.label, catalogo);
    if (s) total += s.costo * Math.max(0, Number(i.qty) || 0);
  }
  return redondea(total);
}

/** ¿Algún concepto es de diseño? */
export function llevaDiseno(items: readonly { label: string }[], catalogo: readonly ServicioDisenoPublico[]): boolean {
  return items.some((i) => !!servicioDeLabel(i.label, catalogo));
}

/**
 * Cuánto costaría un paquete por separado y cuánto se ahorra.
 * null si no tiene componentes conocidos o si no hay ahorro que presumir.
 */
export function ahorroPaquete(
  paquete: ServicioDisenoPublico,
  catalogo: readonly ServicioDisenoPublico[],
): { separado: number; ahorro: number } | null {
  if (!paquete.componentes?.length) return null;
  let separado = 0;
  for (const c of paquete.componentes) {
    const s = catalogo.find((x) => x.id === c.id);
    if (!s) return null;
    separado += s.precio * Math.max(1, Number(c.cantidad) || 1);
  }
  const ahorro = redondea(separado - paquete.precio);
  return ahorro > 0 ? { separado: redondea(separado), ahorro } : null;
}

/**
 * Valida lo que se le va a pagar al diseñador contra el total de la
 * cotización en pesos. Devuelve el problema, o null si está bien.
 *
 * Un costo mayor al total es cobrar menos de lo que se paga: pasa con un
 * descuento o un crédito grandes, y hay que verlo antes de mandarla.
 */
export function validarCosto(costo: unknown, totalMxn: number): string | null {
  const c = Number(costo);
  if (!Number.isFinite(c) || c < 0) return "El pago al diseñador tiene que ser un número de 0 en adelante.";
  if (c > (Number(totalMxn) || 0) + 0.5) {
    return "Lo que se le paga al diseñador es más que el total de la cotización: revisa el descuento o el crédito.";
  }
  return null;
}

/**
 * Título del proyecto/venta de diseño con el tema al que pertenece:
 * "Paquete Lanzamiento Básico" + "Alto Nivel" → "Paquete Lanzamiento Básico — Alto Nivel".
 * Si ya lo trae (lo escribió alguien a mano), no lo repite.
 */
export function tituloConTema(titulo: string, tema: string | null | undefined): string {
  const t = String(titulo || "").trim();
  const n = String(tema || "").trim();
  if (!n || normalizar(t).includes(normalizar(n))) return t;
  return `${t} — ${n}`.slice(0, 160);
}

/** Lo que le queda a ARIDO después de pagarle al diseñador. */
export function margen(totalMxn: number, costo: number): { monto: number; pct: number } {
  const t = Number(totalMxn) || 0;
  const monto = redondea(t - (Number(costo) || 0));
  return { monto, pct: t > 0 ? Math.round((monto / t) * 100) : 0 };
}
