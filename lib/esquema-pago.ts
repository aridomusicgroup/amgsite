/**
 * Cómo se cobra un servicio a la medida — se elige al cotizar, no al firmar el
 * acuerdo. El acuerdo marco solo dice "el esquema que diga tu cotización";
 * aquí vive el número real.
 *
 * Módulo PURO: sin base de datos, para poder probarlo solo.
 */

export type EsquemaPago = "estandar" | "etapas" | "por_cancion" | "mensualidades" | "contado";

export const ESQUEMAS_PAGO: EsquemaPago[] = ["estandar", "etapas", "por_cancion", "mensualidades", "contado"];

export const ESQUEMA_LABEL: Record<EsquemaPago, string> = {
  estandar: "Estándar — 50% anticipo, 50% al entregar",
  etapas: "Por etapas — 40% / 30% / 30%",
  por_cancion: "Por canción — se cobra cada una al entregarla",
  mensualidades: "Mensualidades — 3 pagos iguales",
  contado: "De contado — 100% por adelantado",
};

interface Tramo {
  label: string;
  pct: number;
}

/** Esquemas con proporciones fijas. `por_cancion` no entra: depende de cuántas canciones tenga el proyecto. */
const TRAMOS_FIJOS: Partial<Record<EsquemaPago, Tramo[]>> = {
  estandar: [
    { label: "Anticipo, para reservar agenda", pct: 50 },
    { label: "Antes de la entrega final", pct: 50 },
  ],
  etapas: [
    { label: "Al arrancar el proyecto", pct: 40 },
    { label: "A media obra", pct: 30 },
    { label: "Antes de la entrega final", pct: 30 },
  ],
  mensualidades: [
    { label: "Primer pago, al arrancar", pct: 100 / 3 },
    { label: "Segundo pago, a 30 días", pct: 100 / 3 },
    { label: "Tercer pago, a 60 días — antes de entregar", pct: 100 / 3 },
  ],
  contado: [{ label: "Pago único, por adelantado", pct: 100 }],
};

export interface TramoCalculado {
  label: string;
  monto: number;
}

/**
 * Los pagos reales para un total dado.
 *
 * El ÚLTIMO tramo absorbe el redondeo (nunca el primero): así la suma de los
 * tramos siempre cuadra exacto con el total, y lo que se ajusta un par de
 * centavos es el pago más lejano, no el anticipo que se cobra ya.
 */
export function tramosDe(esquema: EsquemaPago, total: number, numCanciones?: number | null): TramoCalculado[] {
  const monto = Math.max(0, Number(total) || 0);

  if (esquema === "por_cancion") {
    const n = Math.max(1, Math.round(Number(numCanciones) || 1));
    const porCancion = Math.round((monto / n) * 100) / 100;
    let acumulado = 0;
    return Array.from({ length: n }, (_, i) => {
      const esUltima = i === n - 1;
      const m = esUltima ? Math.round((monto - acumulado) * 100) / 100 : porCancion;
      acumulado += m;
      return { label: `Canción ${i + 1} de ${n}, al entregarla`, monto: m };
    });
  }

  const tramos = TRAMOS_FIJOS[esquema] ?? TRAMOS_FIJOS.estandar!;
  let acumulado = 0;
  return tramos.map((t, i) => {
    const esUltimo = i === tramos.length - 1;
    const m = esUltimo ? Math.round((monto - acumulado) * 100) / 100 : Math.round(((monto * t.pct) / 100) * 100) / 100;
    acumulado += m;
    return { label: t.label, monto: m };
  });
}

export const esEsquemaValido = (v: string | null | undefined): v is EsquemaPago =>
  !!v && (ESQUEMAS_PAGO as string[]).includes(v);
