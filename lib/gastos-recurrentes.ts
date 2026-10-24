/**
 * Infiere gastos recurrentes (renta, suscripciones, servicios…) a partir del
 * historial de `egresos` — no hay una tabla de "gastos fijos" que el staff
 * llene a mano, se deduce de lo que ya se ha ido registrando cada mes.
 *
 * Módulo PURO: sin base de datos, para poder probarlo solo. El cron
 * (`/api/cron/pagos-recurrentes`) es quien lo conecta con Supabase y los avisos.
 */

export interface EgresoLite {
  fecha: string; // ISO yyyy-mm-dd
  categoria: string | null;
  proveedor: string | null;
  descripcion: string | null;
  total_mxn: number;
  es_capex: boolean;
}

export interface GastoRecurrente {
  /** Estable entre corridas — identifica el mismo gasto mes a mes. */
  clave: string;
  etiqueta: string;
  montoEstimado: number;
  vecesVisto: number;
  ultimaFecha: string;
  proximaFecha: string; // ISO yyyy-mm-dd
  /** "explicito" = viene de un registro a mano en `gastos_recurrentes`; ausente = detectado del patrón de egresos. */
  origen?: "explicito";
}

/** Un pago recurrente dado de alta a mano (tabla `gastos_recurrentes`). */
export interface GastoRecurrenteRegistrado {
  id: string;
  nombre: string;
  categoria: string | null;
  proveedor: string | null;
  montoEstimado: number;
  diaMes: number; // 1-31
  /** Cada cuántos meses toca: 1 = mensual, 2 = bimestral (la luz de CFE)… */
  cadaMeses?: number;
  activo: boolean;
}

/** Periodicidades que se ofrecen en el panel (`gastos_recurrentes.cada_meses`). */
export const PERIODOS: { meses: number; label: string }[] = [
  { meses: 1, label: "Cada mes" },
  { meses: 2, label: "Cada 2 meses" },
  { meses: 3, label: "Cada 3 meses" },
  { meses: 6, label: "Cada 6 meses" },
  { meses: 12, label: "Cada año" },
];

/** "cada mes", "cada 2 meses", "cada año"… para mostrar junto al día. */
export const etiquetaPeriodo = (cadaMeses: number): string =>
  cadaMeses <= 1 ? "cada mes" : cadaMeses === 12 ? "cada año" : `cada ${cadaMeses} meses`;

const MS_DIA = 24 * 60 * 60 * 1000;

const normaliza = (s: string | null | undefined): string => (s || "").trim().toLowerCase();

function aFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function aISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Mismo día del mes, un mes después — recorta al último día si ese mes es más corto (31 ene → 28/29 feb). */
function unMesDespues(iso: string): string {
  const d = aFecha(iso);
  const dia = d.getDate();
  const siguiente = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const ultimoDiaMes = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
  siguiente.setDate(Math.min(dia, ultimoDiaMes));
  return aISO(siguiente);
}

/** Minúsculas y sin acentos: "Chávez" → "chavez". */
const sinAcentos = (s: string): string =>
  Array.from(s.normalize("NFD"))
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c < 0x300 || c > 0x36f; // fuera del bloque de acentos combinados
    })
    .join("");

/** Texto para comparar igualdad: sin acentos, mayúsculas ni espacios de más. Los signos SÍ cuentan ("Disney" ≠ "Disney+"). */
const textoExacto = (s: string | null | undefined): string => sinAcentos(normaliza(s)).split(/ +/).join(" ");

/** Palabras sueltas de un nombre: "Paco Chávez " → ["paco", "chavez"]. */
const palabrasDe = (s: string | null | undefined): string[] =>
  sinAcentos(normaliza(s)).split(/[^a-z0-9]+/).filter(Boolean);

/** Las palabras del más corto están todas en el más largo: "Paco" / "Paco Chávez". Un nombre sin palabras no se parece a nada. */
function sonParecidas(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  return corto.every((p) => largo.includes(p));
}

/** Quién cobró un egreso: el proveedor, o la descripción si no se capturó proveedor. */
const quienDe = (e: EgresoLite): string | null => (normaliza(e.proveedor) ? e.proveedor : e.descripcion);

/** Lo que hace falta de un registro a mano para saber qué pagos son suyos. */
type RegistroBasico = Pick<GastoRecurrenteRegistrado, "id" | "nombre" | "categoria" | "proveedor" | "montoEstimado" | "activo">;

/** Cómo se llama un registro a mano: su proveedor, o su nombre si no tiene. */
const proveedorONombre = (r: RegistroBasico): string | null => (normaliza(r.proveedor) ? r.proveedor : r.nombre);

const etiquetaDe = (e: EgresoLite): string =>
  [e.categoria, e.proveedor].filter(Boolean).join(" · ") || e.descripcion || e.categoria || "Gasto";

/** "Escrito igual": misma categoría y mismo nombre (sin acentos ni mayúsculas). */
const llaveDe = (categoria: string | null, nombre: string | null): string => `${textoExacto(categoria)}|${textoExacto(nombre)}`;

const mesDe = (fecha: string): string => fecha.slice(0, 7);

const ultimaFecha = (pagos: EgresoLite[]): string | null =>
  pagos.reduce<string | null>((ultima, e) => (!ultima || e.fecha > ultima ? e.fecha : ultima), null);

/** Cuánto puede variar el monto de un pago "escrito parecido" para contarse como pago de un gasto registrado. */
const TOLERANCIA_MONTO = 0.1;

const montoCuadra = (monto: number, referencia: number): boolean =>
  referencia > 0 && Math.abs((Number(monto) || 0) - referencia) <= referencia * TOLERANCIA_MONTO;

/**
 * Qué pagos son de cada registro a mano. Regla: un pago es de un registro si
 * está escrito IGUAL (misma categoría y nombre, sin acentos ni mayúsculas).
 *
 * Además, un pago escrito PARECIDO cuenta como suyo ("Paco Chávez" para el
 * registro "Paco") solo si se cumplen las cuatro:
 *  - misma categoría y es un proveedor de verdad (no texto libre de la descripción);
 *  - el registro está activo y también tiene proveedor (uno pausado o solo con nombre no atrapa nada:
 *    esconder una serie entera por un estimado parecido es peor que avisar de más);
 *  - el nombre de uno contiene al del otro;
 *  - el monto cuadra con el estimado del registro (±10%), y es el ÚNICO registro al que cuadra.
 * Ante la duda NO cuenta: un aviso de más se nota y se arregla; contar un pago
 * ajeno calla un aviso verdadero y nadie lo ve. Así "Vercel Pro upgrade" por
 * $600 no paga la mensualidad de Vercel de $338, ni "Foco de luz LED" la luz.
 *
 * Lo que no es de ningún registro (`sobrantes`) es lo que se infiere solo.
 */
function asignarPagos(registrados: RegistroBasico[], egresos: EgresoLite[]): { pagosDe: Map<string, EgresoLite[]>; sobrantes: EgresoLite[] } {
  const info = registrados.map((r) => ({
    r,
    llave: llaveDe(r.categoria, proveedorONombre(r)),
    categoria: textoExacto(r.categoria),
    palabras: palabrasDe(proveedorONombre(r)),
    puedeAtrapar: r.activo && normaliza(r.proveedor) !== "",
  }));
  const pagosDe = new Map<string, EgresoLite[]>(registrados.map((r): [string, EgresoLite[]] => [r.id, []]));
  const sobrantes: EgresoLite[] = [];

  for (const e of egresos) {
    if (e.es_capex) continue;
    const quien = quienDe(e);
    const llave = llaveDe(e.categoria, quien);

    const iguales = info.filter((i) => i.llave === llave);
    if (iguales.length > 0) {
      for (const i of iguales) pagosDe.get(i.r.id)?.push(e);
      continue;
    }

    const esProveedor = normaliza(e.proveedor) !== "";
    const palabras = esProveedor ? palabrasDe(quien) : [];
    const categoria = textoExacto(e.categoria);
    const candidatos = esProveedor
      ? info.filter((i) => i.puedeAtrapar && i.categoria === categoria && sonParecidas(i.palabras, palabras) && montoCuadra(e.total_mxn, i.r.montoEstimado))
      : [];
    if (candidatos.length === 1) pagosDe.get(candidatos[0].r.id)?.push(e);
    else sobrantes.push(e);
  }
  return { pagosDe, sobrantes };
}

/**
 * Fecha del último pago de cada registro a mano (null si nunca se ha pagado),
 * por id. Una sola definición de "¿ya se pagó?" para el cron y el panel — con
 * su propia copia cada uno ya se desalineó una vez (Google One).
 */
export function ultimasPagadas(registrados: RegistroBasico[], egresos: EgresoLite[]): Map<string, string | null> {
  const { pagosDe } = asignarPagos(registrados, egresos);
  return new Map(registrados.map((r): [string, string | null] => [r.id, ultimaFecha(pagosDe.get(r.id) ?? [])]));
}

/** Un gasto con pagos recientes, tal como se compara para saber si otro lo sucedió. */
interface Vivo {
  llave: string;
  categoria: string;
  palabras: string[];
  /** Todos sus pagos tienen proveedor (no son texto libre). */
  esProveedor: boolean;
  meses: Set<string>;
  ultima: string;
  /** Monto del último pago. */
  monto: number;
}

/** Meses en que se pagaron los dos: el relevo de un nombre a otro puede coincidir en uno, no en más. */
const MESES_COMPARTIDOS_MAX = 1;

/**
 * `t` es la CONTINUACIÓN de `s`: el mismo tipo de gasto con otro nombre, más
 * reciente, por un monto casi igual (±10%), y que casi nunca se pagó en el mismo
 * mes que `s`. Una continuación reemplaza al nombre viejo en el tiempo; un gasto
 * distinto con nombre parecido ("Plan A" y "Plan A+", "Amazon" y "Amazon Prime")
 * convive con el otro, o cobra otra cantidad.
 */
function sucede(t: Vivo, s: Vivo): boolean {
  if (t.llave === s.llave || !t.esProveedor || !s.esProveedor || t.categoria !== s.categoria) return false;
  if (t.ultima <= s.ultima || !sonParecidas(t.palabras, s.palabras) || !montoCuadra(t.monto, s.monto)) return false;
  return Array.from(t.meses).filter((m) => s.meses.has(m)).length <= MESES_COMPARTIDOS_MAX;
}

/** Un recurrente detectado y lo necesario para saber si otro lo sucedió. */
interface Detectado {
  vivo: Vivo;
  gasto: GastoRecurrente;
}

/**
 * Agrupa por gasto (categoría + proveedor, o categoría + descripción si no hay
 * proveedor) y se queda con los grupos donde las últimas dos ocurrencias
 * caen a 20-40 días de distancia — el margen de un "mes" con algo de
 * tolerancia (rentas que se pagan un poco antes o después, fines de semana).
 * Excluye `es_capex` (equipo/gear: inversión, no es un gasto que se repita).
 *
 * Cada grupo cuenta SOLO sus pagos escritos igual: un pago suelto con un nombre
 * parecido nunca se suma ni resta a la serie de otro.
 */
function detectar(egresos: EgresoLite[]): Detectado[] {
  interface Grupo { etiqueta: string; clave: string; categoria: string; palabras: string[]; esProveedor: boolean; fechas: string[]; montos: number[] }
  const grupos = new Map<string, Grupo>();

  // Más viejo primero; con la misma fecha, por etiqueta: el resultado no depende del orden de entrada.
  const ordenados = [...egresos].sort((a, b) => a.fecha.localeCompare(b.fecha) || etiquetaDe(a).localeCompare(etiquetaDe(b)));
  for (const e of ordenados) {
    if (e.es_capex) continue;
    if (!e.categoria && !e.proveedor && !e.descripcion) continue;
    const quien = quienDe(e);
    if (!normaliza(e.categoria) && !normaliza(quien)) continue;

    const llave = llaveDe(e.categoria, quien);
    const g = grupos.get(llave);
    const esProveedor = normaliza(e.proveedor) !== "" && (g?.esProveedor ?? true);
    const nuevo: Grupo = {
      // Etiqueta y clave se quedan con la primera escritura del grupo, igual que siempre: así la clave
      // (que identifica el aviso en la bitácora) no cambia cuando llega otra ortografía del mismo gasto.
      etiqueta: g?.etiqueta ?? etiquetaDe(e),
      clave: g?.clave ?? claveDe(e.categoria, quien),
      categoria: textoExacto(e.categoria),
      palabras: palabrasDe(quien),
      esProveedor,
      fechas: [...(g?.fechas ?? []), e.fecha],
      montos: [...(g?.montos ?? []), Number(e.total_mxn) || 0],
    };
    grupos.set(llave, nuevo);
  }

  const recurrentes: Detectado[] = [];
  for (const [llave, g] of grupos) {
    if (g.fechas.length < 2) continue;
    const fechasOrdenadas = [...g.fechas].sort();
    const ultima = fechasOrdenadas[fechasOrdenadas.length - 1];
    const penultima = fechasOrdenadas[fechasOrdenadas.length - 2];
    const gapDias = Math.round((aFecha(ultima).getTime() - aFecha(penultima).getTime()) / MS_DIA);
    if (gapDias < 20 || gapDias > 40) continue; // no se ve mensual

    recurrentes.push({
      vivo: {
        llave, categoria: g.categoria, palabras: g.palabras, esProveedor: g.esProveedor, meses: new Set(g.fechas.map(mesDe)), ultima,
        monto: g.montos[g.fechas.indexOf(ultima)] ?? g.montos[g.montos.length - 1],
      },
      gasto: {
        clave: g.clave,
        etiqueta: g.etiqueta,
        // El último monto pagado predice mejor el próximo que un promedio
        // histórico (las suscripciones/rentas suben de precio, no bajan).
        montoEstimado: g.montos[g.fechas.indexOf(ultima)] ?? g.montos[g.montos.length - 1],
        vecesVisto: g.fechas.length,
        ultimaFecha: ultima,
        proximaFecha: unMesDespues(ultima),
      },
    });
  }

  return recurrentes.sort((a, b) => a.gasto.proximaFecha.localeCompare(b.gasto.proximaFecha));
}

/**
 * Quita las series que otra con nombre parecido ya sucedió ("Paco Chávez" que
 * pasó a ser "Paco"): ese fantasma vencía para siempre porque nadie le volvió
 * a capturar un pago. Solo las retira una continuación VIVA — un pago suelto o
 * una serie sin pagos recientes no basta —, así que un atraso de verdad sigue
 * avisando. `otros` son gastos vivos que no salen de la inferencia (los registros).
 */
function retirarSucedidos(series: Detectado[], otros: Vivo[]): Detectado[] {
  const vivos = [...series.map((s) => s.vivo), ...otros];
  return series.filter((s) => !vivos.some((t) => sucede(t, s.vivo)));
}

export function detectarRecurrentes(egresos: EgresoLite[]): GastoRecurrente[] {
  return retirarSucedidos(detectar(egresos), []).map((d) => d.gasto);
}

/** Los que vencen dentro de `diasAntes` días, o que ya se pasaron de fecha (nadie lo registró todavía). */
export function pagosPendientes(recurrentes: GastoRecurrente[], hoyISO: string, diasAntes = 5): GastoRecurrente[] {
  const limite = aISO(new Date(aFecha(hoyISO).getTime() + diasAntes * MS_DIA));
  return recurrentes.filter((r) => r.proximaFecha <= limite);
}

/** Ciclo (año-mes) al que pertenece un aviso — para no duplicar la campanita cada día que corre el cron. */
export const cicloDe = (proximaFechaISO: string): string => proximaFechaISO.slice(0, 7);

function ultimoDiaDelMes(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/** Ocurrencia de `diaMes` en el mes de `iso` (recortada a fin de mes). */
function ocurrenciaEnMesDe(diaMes: number, iso: string): string {
  const d = aFecha(iso);
  const y = d.getFullYear(), m = d.getMonth();
  return aISO(new Date(y, m, Math.min(diaMes, ultimoDiaDelMes(y, m))));
}

/** Cada cuántos meses, saneado: entero de 1 a 12 (1 si viene vacío o raro). */
const saneaCada = (cadaMeses: number | null | undefined): number =>
  Math.min(12, Math.max(1, Math.trunc(Number(cadaMeses) || 1)));

/**
 * Ocurrencia de `diaMes` `cadaMeses` meses DESPUÉS del mes de `desdeISO` — no
 * del día exacto. Si alguien paga unos días antes de la fecha (pagó Google One
 * el 5, el cargo real es el 7), ese pago sigue cerrando el ciclo de ESE mes;
 * comparar por día exacto lo dejaba "sin pagar" y el aviso no se apagaba nunca
 * aunque ya se hubiera registrado el pago. Con `cadaMeses = 2` (la luz), el
 * pago de agosto deja el siguiente vencimiento en octubre, no en septiembre.
 */
function siguienteOcurrencia(diaMes: number, desdeISO: string, cadaMeses = 1): string {
  const d = aFecha(desdeISO);
  const y = d.getFullYear(), m = d.getMonth() + saneaCada(cadaMeses);
  return aISO(new Date(y, m, Math.min(diaMes, ultimoDiaDelMes(y, m))));
}

/**
 * Próximo vencimiento de un registro EXPLÍCITO: si ya se pagó antes, la
 * siguiente ocurrencia después del último pago; si nunca se ha pagado, la
 * ocurrencia de ESTE mes (aunque ya haya pasado — así avisa desde el día uno,
 * sin necesitar 2+ pagos de historial como sí requiere la inferencia).
 */
export function proximoVencimiento(diaMes: number, ultimaPagadaISO: string | null, hoyISO: string, cadaMeses = 1): string {
  if (ultimaPagadaISO) return siguienteOcurrencia(diaMes, ultimaPagadaISO, cadaMeses);
  return ocurrenciaEnMesDe(diaMes, hoyISO);
}

/**
 * Clave estable de un gasto: categoría + (proveedor o el propio nombre/
 * descripción). Solo IDENTIFICA (p. ej. la fila de la bitácora por ciclo).
 * Qué pagos son de cada registro lo decide `asignarPagos`, y "¿ya se pagó?" lo
 * responde `ultimasPagadas`, compartida por el cron y el panel — con copias
 * separadas ya se desalinearon una vez (bug real: Google One quedaba "pagado"
 * para el cron pero seguía "pendiente" en el panel).
 */
export function claveDe(categoria: string | null, proveedorODescripcion: string | null): string {
  return `${normaliza(categoria)}::${normaliza(proveedorODescripcion)}`;
}

/**
 * Combina lo registrado a mano con lo inferido, PURO (sin DB): lo registrado
 * gana para su gasto (evita aviso doble de lo mismo) y no depende de que ya
 * se haya capturado 2 veces. Un registro pausado (`activo=false`) tampoco
 * deja pasar la inferencia de ese gasto — se pausó a propósito.
 */
export function combinarConRegistrados(
  registrados: GastoRecurrenteRegistrado[],
  egresos: EgresoLite[],
  hoyISO: string,
): GastoRecurrente[] {
  const { pagosDe, sobrantes } = asignarPagos(registrados, egresos);
  const explicitos: GastoRecurrente[] = [];
  const continuaciones: Vivo[] = [];

  for (const r of registrados) {
    const pagos = pagosDe.get(r.id) ?? [];
    const ultimaPagada = ultimaFecha(pagos);

    // Un registro (aun pausado) con proveedor y pagos también puede ser la continuación de una serie
    // vieja que cambió de nombre. El monto que cuenta es el de su último pago.
    const ultimoPago = ultimaPagada ? pagos.find((p) => p.fecha === ultimaPagada) : undefined;
    if (ultimoPago && normaliza(r.proveedor)) {
      continuaciones.push({
        llave: llaveDe(r.categoria, r.proveedor),
        categoria: textoExacto(r.categoria),
        palabras: palabrasDe(r.proveedor),
        esProveedor: true,
        meses: new Set(pagos.map((p) => mesDe(p.fecha))),
        ultima: ultimoPago.fecha,
        monto: Number(ultimoPago.total_mxn) || 0,
      });
    }

    if (!r.activo) continue;
    explicitos.push({
      clave: claveDe(r.categoria, proveedorONombre(r)),
      etiqueta: [r.categoria, r.proveedor].filter(Boolean).join(" · ") || r.nombre,
      montoEstimado: r.montoEstimado,
      vecesVisto: ultimaPagada ? 1 : 0,
      ultimaFecha: ultimaPagada ?? "",
      proximaFecha: proximoVencimiento(r.diaMes, ultimaPagada, hoyISO, r.cadaMeses ?? 1),
      origen: "explicito",
    });
  }

  const inferidos = retirarSucedidos(detectar(sobrantes), continuaciones).map((d) => d.gasto);
  return [...explicitos, ...inferidos].sort((a, b) => a.proximaFecha.localeCompare(b.proximaFecha));
}
