// Las seis bolsas: cada peso cobrado se reparte en este orden.
//   directos → impuestos → operación → sueldos de socios → colchón → reparto
// Motor puro (sin Supabase) para que Finanzas, el reparto trimestral y la
// nómina usen exactamente la misma cuenta. Si un mes no alcanza, las primeras
// bolsas se llenan y lo que falte sale del colchón; el reparto nunca es negativo.

export interface EscalonSueldo { desde: number; semanal: number }

export interface AjustesBolsas {
  impuestosPct: number;
  colchonPct: number;
  colchonMeta: number;
  /** Lo que ya había en el fondo el día de `inicio`. */
  colchonInicial: number;
  /** YYYY-MM-DD: desde cuándo se aparta de verdad y se lleva el saldo del colchón. */
  inicio: string;
  /** Sueldo semanal de cada socio según el promedio cobrado de 3 meses. */
  escalones: EscalonSueldo[];
  /** false = valores por defecto (todavía no se corre supabase-bolsas.sql). */
  guardado: boolean;
}

export const AJUSTES_DEFAULT: AjustesBolsas = {
  impuestosPct: 10,
  colchonPct: 15,
  colchonMeta: 80000,
  colchonInicial: 0,
  inicio: "2026-09-01",
  escalones: [
    { desde: 60000, semanal: 2000 },
    { desde: 50000, semanal: 1500 },
    { desde: 0, semanal: 1200 },
  ],
  guardado: false,
};

/** Lo que pasó en un mes (YYYY-MM), en MXN. */
export interface MesFinanzas {
  mes: string;
  cobrado: number;
  /** Músicos y comisiones de plataforma: no es ingreso del estudio. */
  directos: number;
  /** Renta, servicios, software y nómina de colaboradores. */
  operacion: number;
  /** Nómina de los socios. */
  sueldosSocios: number;
}

export interface BolsasMes extends MesFinanzas {
  impuestos: number;
  colchon: number;
  reparto: number;
  /** Lo que no alcanzó a cubrir directos, impuestos, operación y sueldos. */
  faltante: number;
  /** Saldo del colchón al cerrar el mes; null antes de `inicio`. */
  colchonSaldo: number | null;
  /** true si el mes ya cae dentro del periodo en que se aparta de verdad. */
  real: boolean;
}

const mesDe = (fecha: string) => fecha.slice(0, 7);

/** Aplica las bolsas mes por mes, en orden, llevando el saldo del colchón desde `inicio`. */
export function calcularBolsas(meses: MesFinanzas[], a: AjustesBolsas): BolsasMes[] {
  const inicio = mesDe(a.inicio);
  let saldo = a.colchonInicial;
  return [...meses]
    .sort((x, y) => x.mes.localeCompare(y.mes))
    .map((m) => {
      const real = m.mes >= inicio;
      let resto = m.cobrado;
      let faltante = 0;
      const toma = (quiere: number) => {
        const t = Math.min(quiere, Math.max(resto, 0));
        resto -= t;
        faltante += quiere - t;
        return t;
      };
      toma(m.directos);
      const impuestos = toma((m.cobrado * a.impuestosPct) / 100);
      toma(m.operacion);
      toma(m.sueldosSocios);

      const hueco = real ? Math.max(0, a.colchonMeta - saldo) : Infinity;
      const colchon = Math.min((m.cobrado * a.colchonPct) / 100, Math.max(resto, 0), hueco);
      resto -= colchon;
      if (real) saldo = saldo + colchon - faltante;

      return {
        ...m,
        impuestos,
        colchon,
        reparto: Math.max(resto, 0),
        faltante,
        colchonSaldo: real ? saldo : null,
        real,
      };
    });
}

/** "2026-09" → "2026-T3" */
export const trimestreDeMes = (mes: string) => {
  const [y, mm] = mes.split("-").map(Number);
  return `${y}-T${Math.floor((mm - 1) / 3) + 1}`;
};

/** Suma de las bolsas de los meses de un trimestre ("2026-T3"). */
export function bolsasDelTrimestre(bolsas: BolsasMes[], trimestre: string) {
  const meses = bolsas.filter((b) => trimestreDeMes(b.mes) === trimestre);
  const suma = (k: keyof Pick<BolsasMes, "cobrado" | "directos" | "operacion" | "sueldosSocios" | "impuestos" | "colchon" | "reparto" | "faltante">) =>
    meses.reduce((acc, b) => acc + b[k], 0);
  return {
    meses: meses.map((b) => b.mes),
    cobrado: suma("cobrado"),
    directos: suma("directos"),
    operacion: suma("operacion"),
    sueldosSocios: suma("sueldosSocios"),
    impuestos: suma("impuestos"),
    colchon: suma("colchon"),
    reparto: suma("reparto"),
    faltante: suma("faltante"),
  };
}

/** Promedio cobrado de los 3 meses completos anteriores a `mesActual` (YYYY-MM). */
export function promedioTresMeses(meses: MesFinanzas[], mesActual: string): { promedio: number; meses: string[] } {
  const previos = meses
    .filter((m) => m.mes < mesActual)
    .sort((x, y) => y.mes.localeCompare(x.mes))
    .slice(0, 3);
  if (previos.length === 0) return { promedio: 0, meses: [] };
  const total = previos.reduce((acc, m) => acc + m.cobrado, 0);
  return { promedio: total / 3, meses: previos.map((m) => m.mes).reverse() };
}

/** Sueldo semanal de cada socio para un promedio de 3 meses. */
export function sueldoSocio(promedio: number, escalones: EscalonSueldo[]): number {
  const orden = [...escalones].sort((x, y) => y.desde - x.desde);
  return (orden.find((e) => promedio >= e.desde) ?? orden[orden.length - 1] ?? { semanal: 0 }).semanal;
}
