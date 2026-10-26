// Pruebas del costo de un día de operación y su comparación con lo que entra.
// Lo que NO debe pasar: que el costo salga barato porque faltan gastos capturados
// (se calcula con lo configurado), que la nómina se cuente doble (equipo + egresos
// viejos "Nómina") o que un mes corto/largo cambie lo que cuesta operar.
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import * as lib from "./operacion.ts";

const {
  DIAS_POR_MES, mensualDe, diasEnMes, costosRecurrentes, armarPartidas, porcentajeDirectos,
  margenDeContribucion, diasQuePaga, diasDeAire, resumirOperacion, agruparMeses, armarFuente, hoyEnMexico,
} = lib;

const cerca = (real, esperado, tol = 0.01) =>
  assert.ok(Math.abs(real - esperado) <= tol, `esperaba ≈ ${esperado}, salió ${real}`);

// ── Lo que cuesta cada persona al mes ──────────────────────────────────────

test("un pago semanal se vuelve mensual con 52/12 semanas", () => {
  cerca(mensualDe(1200, "semanal"), 5200);
});

test("quincenal son 2 pagos al mes y mensual es el mismo monto", () => {
  assert.equal(mensualDe(1000, "quincenal"), 2000);
  assert.equal(mensualDe(5000, "mensual"), 5000);
});

test("sin periodicidad conocida se toma como mensual (no inventa semanas)", () => {
  assert.equal(mensualDe(5000, null), 5000);
  assert.equal(mensualDe(5000, "raro"), 5000);
});

test("un monto raro (negativo o NaN) no resta ni rompe el costo", () => {
  assert.equal(mensualDe(-100, "semanal"), 0);
  assert.equal(mensualDe(Number.NaN, "mensual"), 0);
});

test("los días de cada mes son los reales, febrero bisiesto incluido", () => {
  assert.equal(diasEnMes("2026-02"), 28);
  assert.equal(diasEnMes("2028-02"), 29);
  assert.equal(diasEnMes("2026-10"), 31);
});

// ── Pagos recurrentes que cuentan como costo ────────────────────────────────

const HOY = "2026-10-10";
const registrado = (nombre, montoEstimado, cadaMeses = 1, activo = true) => ({ nombre, montoEstimado, cadaMeses, activo });
const inferido = (etiqueta, montoEstimado, ultimaFecha) => ({ etiqueta, montoEstimado, ultimaFecha });

test("la luz bimestral cuesta la mitad por mes; un registro pausado no cuesta nada", () => {
  const r = costosRecurrentes({
    registrados: [registrado("Luz", 4112, 2), registrado("Renta", 3500), registrado("Vieja suscripción", 999, 1, false)],
    combinados: [],
    hoy: HOY,
  });
  assert.deepEqual(r.map((x) => [x.concepto, x.mensual]), [["Luz", 2056], ["Renta", 3500]]);
});

test("un gasto detectado del historial cuenta si sigue vivo", () => {
  const r = costosRecurrentes({
    registrados: [],
    combinados: [inferido("Servicios · Internet", 600, "2026-10-01")],
    hoy: HOY,
  });
  assert.deepEqual(r.map((x) => [x.concepto, x.mensual]), [["Servicios · Internet", 600]]);
});

test("un gasto detectado que dejó de pagarse hace más de dos meses ya no cuenta", () => {
  const r = costosRecurrentes({
    registrados: [],
    combinados: [inferido("Servicios · Suscripción vieja", 600, "2026-07-01")],
    hoy: HOY,
  });
  assert.deepEqual(r, []);
});

test("lo registrado a mano no se cuenta dos veces cuando también sale en los combinados", () => {
  const r = costosRecurrentes({
    registrados: [registrado("Renta", 3500)],
    combinados: [{ etiqueta: "Renta Estudio · Paco", montoEstimado: 3500, ultimaFecha: "2026-10-01", origen: "explicito" }],
    hoy: HOY,
  });
  assert.deepEqual(r.map((x) => x.concepto), ["Renta"]);
});

test("la renta registrada no se suma otra vez cuando el historial la detecta con otro nombre y otro monto", () => {
  const r = costosRecurrentes({
    registrados: [{ nombre: "Renta", categoria: "Renta Estudio", proveedor: "Paco", montoEstimado: 3500, cadaMeses: 1, activo: true }],
    combinados: [inferido("Renta Estudio · Paco Chávez", 4200, "2026-10-01")],
    hoy: HOY,
  });
  assert.deepEqual(r.map((x) => [x.concepto, x.mensual]), [["Renta", 3500]]);
});

test("un registro pausado a propósito tampoco deja pasar el gasto que se le parece", () => {
  const r = costosRecurrentes({
    registrados: [{ nombre: "Renta vieja", categoria: "Renta Estudio", proveedor: "Paco", montoEstimado: 3500, cadaMeses: 1, activo: false }],
    combinados: [inferido("Renta Estudio · Paco Chávez", 4200, "2026-10-01")],
    hoy: HOY,
  });
  assert.deepEqual(r, []);
});

test("un gasto detectado de la misma categoría pero de otro proveedor sí cuenta", () => {
  const r = costosRecurrentes({
    registrados: [{ nombre: "Luz", categoria: "Servicios", proveedor: "CFE", montoEstimado: 4112, cadaMeses: 2, activo: true }],
    combinados: [inferido("Servicios · Internet", 600, "2026-10-01")],
    hoy: HOY,
  });
  assert.deepEqual(r.map((x) => x.concepto), ["Luz", "Servicios · Internet"]);
});

test("nómina, comisiones y pagos a músicos detectados NO se cuentan: ya viven en el equipo o en los directos", () => {
  const r = costosRecurrentes({
    registrados: [],
    combinados: [
      inferido("Nómina · Tozi", 7000, "2026-10-01"),
      inferido("Comisión Stripe", 300, "2026-10-01"),
      inferido("Pago músico · Martín", 1000, "2026-10-01"),
      inferido("Pago musico · Adal", 1000, "2026-10-01"),
    ],
    hoy: HOY,
  });
  assert.deepEqual(r, []);
});

// ── Las partidas del día ────────────────────────────────────────────────────

const socio = (nombre, activo = true) => ({ nombre, rol: "socio", pagoBase: 1200, periodicidad: "semanal", activo });
const colab = (nombre, pagoBase, periodicidad, activo = true) => ({ nombre, rol: "colaborador", pagoBase, periodicidad, activo });

test("los socios se juntan en una partida: sueldo por semana × cuántos son", () => {
  const p = armarPartidas({ equipo: [socio("Luis"), socio("Eliud")], recurrentes: [], sueldoSocioSemanal: 1500 });
  assert.equal(p.length, 1);
  assert.equal(p[0].concepto, "Sueldo de socios");
  assert.equal(p[0].esSocio, true);
  cerca(p[0].mensual, (1500 * 2 * 52) / 12);
});

test("el sueldo de socios sale del escalón vigente, no del pago_base viejo del equipo", () => {
  const p = armarPartidas({ equipo: [socio("Luis"), socio("Eliud")], recurrentes: [], sueldoSocioSemanal: 2000 });
  cerca(p[0].mensual, (2000 * 2 * 52) / 12);
});

test("un socio inactivo no cuenta; sin sueldo de socios no hay partida", () => {
  const dos = armarPartidas({ equipo: [socio("Luis"), socio("Eliud", false)], recurrentes: [], sueldoSocioSemanal: 1200 });
  cerca(dos[0].mensual, (1200 * 1 * 52) / 12);
  assert.deepEqual(armarPartidas({ equipo: [socio("Luis")], recurrentes: [], sueldoSocioSemanal: 0 }), []);
});

test("cada colaborador activo con pago es una partida; sin pago o inactivo no", () => {
  const p = armarPartidas({
    equipo: [colab("Tozi", 1700, "semanal"), colab("Diego", 5000, "mensual"), colab("Leo", 0, "semanal"), colab("Ex", 900, "semanal", false)],
    recurrentes: [],
    sueldoSocioSemanal: 0,
  });
  assert.deepEqual(p.map((x) => x.concepto).sort(), ["Diego", "Tozi"]);
  assert.ok(p.every((x) => x.esSocio === false));
});

test("dos partidas con el mismo nombre se distinguen, para que la lista no las fusione", () => {
  const p = armarPartidas({
    equipo: [colab("Luis Pérez", 1000, "mensual"), colab("Luis Pérez", 500, "mensual")],
    recurrentes: [{ concepto: "Luz", mensual: 100 }, { concepto: "Luz", mensual: 50 }],
    sueldoSocioSemanal: 0,
  });
  assert.deepEqual(p.map((x) => x.concepto), ["Luis Pérez", "Luis Pérez (2)", "Luz", "Luz (2)"]);
});

test("los recurrentes se suman y todo sale ordenado de lo más caro a lo más barato", () => {
  const p = armarPartidas({
    equipo: [colab("Diego", 800, "semanal")],
    recurrentes: [{ concepto: "Renta", mensual: 3500 }, { concepto: "Internet", mensual: 600 }],
    sueldoSocioSemanal: 0,
  });
  assert.deepEqual(p.map((x) => x.concepto), ["Renta", "Diego", "Internet"]);
});

// ── Margen: de cada peso cobrado, cuánto queda para operar ─────────────────

// Un mes de las bolsas. Lo cobrado se reparte parejo en los primeros `hastaDia` días (todo el mes por defecto).
const mes = (m, cobrado, directos = 0, operacion = 0, sueldosSocios = 0, hastaDia = diasEnMes(m)) => ({
  mes: m, cobrado, directos, operacion, sueldosSocios,
  cobradoPorDia: Array.from({ length: diasEnMes(m) }, (_, i) => (i < hastaDia ? cobrado / hastaDia : 0)),
});
// Un mes con los cobros en días concretos: { 3: 14000 } = 14,000 el día 3.
const mesCon = (m, cobros, directos = 0, operacion = 0, sueldosSocios = 0) => ({
  mes: m, directos, operacion, sueldosSocios,
  cobrado: Object.values(cobros).reduce((a, x) => a + x, 0),
  cobradoPorDia: Array.from({ length: diasEnMes(m) }, (_, i) => cobros[i + 1] ?? 0),
});

test("el porcentaje de directos sale de los meses completos recientes, sin contar el mes en curso", () => {
  const meses = [mes("2026-07", 10000, 2000), mes("2026-08", 10000, 1000), mes("2026-10", 5000, 4000)];
  cerca(porcentajeDirectos(meses, "2026-10"), 0.15, 1e-9);
});

test("los meses sin cobro no cuentan y sin datos se usa el respaldo", () => {
  assert.equal(porcentajeDirectos([mes("2026-08", 0, 500)], "2026-10"), 0.16);
  assert.equal(porcentajeDirectos([], "2026-10", 6, 0.2), 0.2);
});

test("solo se miran los últimos N meses completos", () => {
  const meses = [mes("2026-01", 1000, 900), mes("2026-08", 1000, 100), mes("2026-09", 1000, 100)];
  cerca(porcentajeDirectos(meses, "2026-10", 2), 0.1, 1e-9);
});

test("un porcentaje absurdo (directos mayores que lo cobrado) se limita a 90%", () => {
  assert.equal(porcentajeDirectos([mes("2026-09", 1000, 5000)], "2026-10"), 0.9);
});

test("el margen es lo que queda después de músicos e impuestos, nunca negativo", () => {
  cerca(margenDeContribucion(0.16, 10), 0.74, 1e-9);
  assert.equal(margenDeContribucion(0.9, 30), 0);
});

// ── Equivalencias ───────────────────────────────────────────────────────────

test("cuántos días de operación paga una venta", () => {
  assert.equal(diasQuePaga(1000, 0.8, 100), 8);
  assert.equal(diasQuePaga(1000, 0.8, 0), 0);
});

test("los días de aire son el colchón entre lo que cuesta un día; sin colchón o sin costo no hay cifra", () => {
  assert.equal(diasDeAire(30000, 300), 100);
  assert.equal(diasDeAire(null, 300), null);
  assert.equal(diasDeAire(30000, 0), null);
});

// ── El resumen completo ────────────────────────────────────────────────────

const partidas = [
  { concepto: "Sueldo de socios", mensual: 6080, esSocio: true },
  { concepto: "Renta", mensual: 3040, esSocio: false },
];
const datos = {
  partidas,
  impuestosPct: 10,
  colchonSaldo: 30000,
  meses: [
    mes("2026-08", 20000, 2000, 2000, 5000),
    mes("2026-09", 10000, 1000, 2000, 5000),
    mes("2026-10", 4000, 0, 0, 0, 10),
  ],
};
const HOY_R = "2026-10-10";

test("el costo del día: socios incluidos son 9,120/30.4 = 300; solo operar son 100", () => {
  const r = resumirOperacion(datos, HOY_R, true);
  assert.equal(r.costoMensual, 9120);
  assert.equal(r.costoDia, 300);
  assert.equal(r.costoDiaConSocios, 300);
  assert.equal(r.costoDiaOperar, 100);
  assert.equal(DIAS_POR_MES, 30.4);
});

test("al apagar a los socios el costo baja, pero los dos números siguen disponibles", () => {
  const r = resumirOperacion(datos, HOY_R, false);
  assert.equal(r.costoMensual, 3040);
  assert.equal(r.costoDia, 100);
  assert.equal(r.costoDiaConSocios, 300);
});

test("el margen y lo que hay que vender para pagar un día", () => {
  const r = resumirOperacion(datos, HOY_R, true);
  cerca(r.directosPct, 0.1, 1e-9);
  cerca(r.margen, 0.8, 1e-9);
  cerca(r.ventaPorDia, 375, 1e-6);
});

test("un mes que cubre la cuenta: dice qué día la cubrió y cuántos días le sobraron", () => {
  const ago = resumirOperacion(datos, HOY_R, true).filas.find((f) => f.mes === "2026-08");
  assert.equal(ago.cubre, true);
  assert.equal(ago.neto, 16000);
  assert.equal(ago.diaEquilibrio, 18);
  cerca(ago.diasDeHolgura, 6880 / 300);
});

test("un mes que no alcanza: no hay día de equilibrio y los días de holgura son negativos", () => {
  const sep = resumirOperacion(datos, HOY_R, true).filas.find((f) => f.mes === "2026-09");
  assert.equal(sep.cubre, false);
  assert.equal(sep.diaEquilibrio, null);
  cerca(sep.diasDeHolgura, -1120 / 300);
});

test("el mes en curso sin cubrir se proyecta con el ritmo de los días que van, y no se da por cubierto", () => {
  const r = resumirOperacion(datos, HOY_R, true);
  assert.equal(r.actual.mes, "2026-10");
  assert.equal(r.actual.enCurso, true);
  assert.equal(r.actual.cubre, false);
  assert.equal(r.actual.diaEquilibrio, null);
  assert.equal(r.actual.ritmo, "llega");
  assert.equal(r.actual.diaProyectado, 29); // 3,200 netos en 10 días = 320/día → 9,120 el día 28.5
  assert.equal(r.actual.transcurridos, 10);
  cerca(r.adelanto, 3200 - 9120 * (10 / 31));
});

test("si el ritmo del mes en curso no alcanza para cubrir antes de que acabe el mes, lo dice", () => {
  const lento = { ...datos, meses: [...datos.meses.slice(0, 2), mes("2026-10", 1000, 0, 0, 0, 10)] };
  const { actual } = resumirOperacion(lento, HOY_R, true);
  assert.equal(actual.ritmo, "no-llega");
  assert.equal(actual.diaProyectado, null);
});

test("sin cobros todavía en el mes en curso hay una fila en ceros, no un hueco", () => {
  const sinOctubre = { ...datos, meses: datos.meses.slice(0, 2) };
  const r = resumirOperacion(sinOctubre, HOY_R, true);
  assert.equal(r.actual.cobrado, 0);
  assert.equal(r.actual.diaEquilibrio, null);
  assert.equal(r.actual.ritmo, "no-llega"); // ya van 10 días y no entró nada: eso sí es una alarma de verdad
});

// ── El día en que de verdad se cubre la cuenta (no un promedio) ─────────────

const base = [mes("2026-07", 10000, 1000), mes("2026-08", 20000, 2000, 2000, 5000)]; // directos 10% → margen 0.8
const conMes = (m) => ({ ...datos, meses: [...base, m] });

test("el día de equilibrio de un mes cerrado es el día real: el mismo total cobrado el día 1 o el día 30 NO da lo mismo", () => {
  const sep = (cobros) => resumirOperacion(conMes(mesCon("2026-09", cobros, 2000)), HOY_R, true).filas.find((f) => f.mes === "2026-09");
  assert.equal(sep({ 1: 20000 }).diaEquilibrio, 1);
  assert.equal(sep({ 30: 20000 }).diaEquilibrio, 30);
});

test("la cuenta se cubre el día en que lo acumulado la alcanza, sumando varias ventas", () => {
  // Netos al 0.8: 4,000 el día 5 y 4,800 el día 12 = 8,800 (aún no); con 3,000 más el día 20 llegan a 11,800 ≥ 9,120.
  const f = resumirOperacion(conMes(mesCon("2026-09", { 5: 5000, 12: 6000, 20: 3750 }, 1475)), HOY_R, true).filas.find((x) => x.mes === "2026-09");
  assert.equal(f.cubre, true);
  assert.equal(f.diaEquilibrio, 20);
});

test("el mes en curso que ya cubrió la cuenta dice el día real, no una proyección", () => {
  const { actual } = resumirOperacion(conMes(mesCon("2026-10", { 3: 14000 })), HOY_R, true);
  assert.equal(actual.cubre, true);
  assert.equal(actual.diaEquilibrio, 3);
  assert.equal(actual.ritmo, null);
});

test("un mes cerrado sin cubrir no tiene día ni proyección", () => {
  const sep = resumirOperacion(datos, HOY_R, true).filas.find((f) => f.mes === "2026-09");
  assert.equal(sep.diaEquilibrio, null);
  assert.equal(sep.ritmo, null);
  assert.equal(sep.diaProyectado, null);
});

test("los primeros días del mes no hay alarma: es pronto para proyectar, aunque no haya entrado nada", () => {
  const vacio = { ...datos, meses: datos.meses.slice(0, 2) };
  for (const hoy of ["2026-10-01", "2026-10-02", "2026-10-04"]) {
    assert.equal(resumirOperacion(vacio, hoy, true).actual.ritmo, "pronto", hoy);
  }
});

test("una sola venta de los primeros días no se proyecta como si fuera el ritmo del mes", () => {
  const unaVenta = conMes(mesCon("2026-10", { 2: 7500 }));
  assert.equal(resumirOperacion(unaVenta, "2026-10-02", true).actual.ritmo, "pronto");
  assert.equal(resumirOperacion(unaVenta, "2026-10-02", true).actual.diaProyectado, null);
});

test("desde el quinto día ya se proyecta", () => {
  const unaVenta = conMes(mesCon("2026-10", { 2: 7500 }));
  assert.equal(resumirOperacion(unaVenta, "2026-10-05", true).actual.ritmo, "llega");
});

test("el último día del mes lo que se va por delante es todo lo neto menos el costo del mes entero", () => {
  const r = resumirOperacion(conMes(mesCon("2026-10", { 3: 5000 })), "2026-10-31", true);
  cerca(r.adelanto, 4000 - 9120);
});

test("en febrero se cuenta con 28 días", () => {
  const feb = { ...datos, meses: [mes("2027-01", 10000, 1000), mes("2027-02", 8000, 0, 0, 0, 14)] };
  const { actual } = resumirOperacion(feb, "2027-02-14", true);
  assert.equal(actual.transcurridos, 14);
  assert.equal(actual.diaProyectado, 20); // 6,400 netos en 14 días → 9,120 el día 19.95
  assert.equal(resumirOperacion({ ...feb, meses: [feb.meses[0], mes("2027-02", 4000, 0, 0, 0, 14)] }, "2027-02-14", true).actual.ritmo, "no-llega"); // 40 > 28
});

test("un mes sin un solo cobro entre dos con cobros aparece en ceros y no alcanzó", () => {
  const huecos = { ...datos, meses: [mes("2026-05", 20000, 2000), mes("2026-08", 20000, 2000), mes("2026-10", 4000, 0, 0, 0, 10)] };
  const filas = resumirOperacion(huecos, HOY_R, true).filas;
  assert.deepEqual(filas.map((f) => f.mes), ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
  const junio = filas.find((f) => f.mes === "2026-06");
  assert.equal(junio.cobrado, 0);
  assert.equal(junio.cubre, false);
});

test("no se inventan meses anteriores al primer cobro", () => {
  const filas = resumirOperacion({ ...datos, meses: [mes("2026-09", 10000, 1000)] }, HOY_R, true).filas;
  assert.deepEqual(filas.map((f) => f.mes), ["2026-09", "2026-10"]);
});

test("hoyEnMexico es una fecha YYYY-MM-DD", () => {
  assert.match(hoyEnMexico(), /^\d{4}-\d{2}-\d{2}$/);
});

test("la captura compara lo registrado contra lo esperado, con los mismos socios que el modo", () => {
  const conSocios = resumirOperacion(datos, HOY_R, true).filas.find((f) => f.mes === "2026-08");
  cerca(conSocios.captura, 7000 / 9120);
  const soloOperar = resumirOperacion(datos, HOY_R, false).filas.find((f) => f.mes === "2026-08");
  cerca(soloOperar.captura, 2000 / 3040);
});

test("los días de aire usan el costo del modo elegido", () => {
  assert.equal(resumirOperacion(datos, HOY_R, true).diasDeAire, 100);
  assert.equal(resumirOperacion(datos, HOY_R, false).diasDeAire, 300);
});

test("solo se muestran los últimos 6 meses, en orden", () => {
  const largo = { ...datos, meses: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((m) => mes(m, 10000)) };
  const filas = resumirOperacion(largo, HOY_R, true).filas.map((f) => f.mes);
  assert.deepEqual(filas, ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
});

test("sin costos configurados avisa y no divide entre cero", () => {
  const r = resumirOperacion({ ...datos, partidas: [] }, HOY_R, true);
  assert.equal(r.sinCostos, true);
  assert.equal(r.costoDia, 0);
  assert.equal(r.ventaPorDia, null);
  assert.ok(r.filas.every((f) => f.diaEquilibrio === null && f.captura === null));
});

test("un mes a futuro en los datos no aparece", () => {
  const r = resumirOperacion({ ...datos, meses: [...datos.meses, mes("2026-12", 999999)] }, HOY_R, true);
  assert.ok(!r.filas.some((f) => f.mes === "2026-12"));
});

// ── De movimientos sueltos a meses (lo que alimenta las bolsas) ────────────

test("agruparMeses: cobros, directos, operación y sueldos de socios por mes", () => {
  const meses = agruparMeses({
    ventas: [
      { fecha: "2026-05-10", total: 1000, costoExtra: 200, tienePagos: false },
      { fecha: "2026-05-12", total: 5000, costoExtra: 800, tienePagos: true },
      { fecha: null, total: 999, costoExtra: 99, tienePagos: false },
    ],
    pagos: [{ fecha: "2026-05-12", monto: 2000 }, { fecha: "2026-06-02", monto: 3000 }],
    otrosIngresos: [{ fecha: "2026-06-15", monto: 500 }],
    egresos: [
      { fecha: "2026-05-01", total: 3500, esCapex: false, categoria: "Renta Estudio" },
      { fecha: "2026-05-02", total: 20000, esCapex: true, categoria: "Equipo" },
      { fecha: "2026-05-03", total: 100, esCapex: false, categoria: "Comisión Stripe" },
      { fecha: "2026-05-04", total: 1700, esCapex: false, categoria: "Nómina" },
    ],
    nomina: [
      { fecha: "2026-06-01", monto: 1200, esSocio: true },
      { fecha: "2026-06-01", monto: 800, esSocio: false },
    ],
  });
  assert.deepEqual(meses, [
    { ...mesCon("2026-05", { 10: 1000, 12: 2000 }, 1100, 5200, 0) },
    { ...mesCon("2026-06", { 2: 3000, 15: 500 }, 0, 800, 1200) },
  ]);
});

test("agruparMeses guarda cuánto se cobró cada día del mes, y todo junto suma lo cobrado", () => {
  const [m] = agruparMeses({
    ventas: [{ fecha: "2026-02-28", total: 700, costoExtra: 0, tienePagos: false }],
    pagos: [{ fecha: "2026-02-03", monto: 300 }, { fecha: "2026-02-03", monto: 200 }],
    otrosIngresos: [],
    egresos: [],
    nomina: [],
  });
  assert.equal(m.cobradoPorDia.length, 28);
  assert.equal(m.cobradoPorDia[2], 500);
  assert.equal(m.cobradoPorDia[27], 700);
  assert.equal(m.cobradoPorDia.reduce((a, x) => a + x, 0), m.cobrado);
});

// ── De las filas crudas de la base a la fuente de la pestaña ────────────────

const filas = {
  ventas: [{ id: "v1", fecha: "2026-09-05", total_mxn: "1000", costo_extra: "100" }, { id: "v2", fecha: "2026-09-06", total_mxn: 5000, costo_extra: null }],
  pagos: [{ venta_id: "v2", fecha: "2026-09-06", monto_mxn: 2000 }],
  ingresos: [{ fecha: "2026-09-10", monto_mxn: 300 }],
  egresos: [
    { fecha: "2026-09-01", total_mxn: 3500, es_capex: false, categoria: "Renta Estudio", proveedor: "Paco", descripcion: null },
    { fecha: null, total_mxn: 99, es_capex: false, categoria: "Raro", proveedor: null, descripcion: null },
  ],
  nomina: [
    { persona_id: "p-socio", periodo_inicio: "2026-09-07", monto: 1500, estado: "pagado" },
    { persona_id: "p-colab", periodo_inicio: "2026-09-07", monto: 800, estado: "pagado" },
    { persona_id: "p-colab", periodo_inicio: "2026-09-14", monto: 800, estado: "cancelado" },
  ],
  equipo: [
    { id: "p-socio", nombre: "Luis", rol: "socio", pago_base: "1200", periodicidad: "semanal", activo: true },
    { id: "p-colab", nombre: "Diego", rol: "colaborador", pago_base: 800, periodicidad: null, activo: false },
  ],
};

test("armarFuente: una venta con pagos cuenta por sus pagos y la que no tiene, por su total", () => {
  const { movimientos } = armarFuente({ ...filas, ajustes: { guardado: false } });
  assert.deepEqual(movimientos.ventas.map((v) => v.tienePagos), [false, true]);
  assert.deepEqual(movimientos.ventas.map((v) => [v.total, v.costoExtra]), [[1000, 100], [5000, 0]]);
  const [sep] = agruparMeses(movimientos);
  assert.equal(sep.cobrado, 1000 + 2000 + 300);
});

test("armarFuente: la nómina cancelada no cuenta, y se distingue a los socios", () => {
  const { movimientos } = armarFuente({ ...filas, ajustes: { guardado: false } });
  assert.deepEqual(movimientos.nomina, [
    { fecha: "2026-09-07", monto: 1500, esSocio: true },
    { fecha: "2026-09-07", monto: 800, esSocio: false },
  ]);
});

test("armarFuente: el equipo y los egresos llegan limpios, y un egreso sin fecha no entra al detector de recurrentes", () => {
  const f = armarFuente({ ...filas, ajustes: { guardado: false } });
  assert.deepEqual(f.equipo, [
    { nombre: "Luis", rol: "socio", pagoBase: 1200, periodicidad: "semanal", activo: true },
    { nombre: "Diego", rol: "colaborador", pagoBase: 800, periodicidad: null, activo: false },
  ]);
  assert.equal(f.egresos.length, 1);
  assert.equal(f.egresos[0].proveedor, "Paco");
  assert.equal(f.movimientos.egresos.length, 2);
});

test("armarFuente con la base vacía no truena", () => {
  const f = armarFuente({ ventas: [], pagos: [], ingresos: [], egresos: [], nomina: [], equipo: [], ajustes: { guardado: false } });
  assert.deepEqual(agruparMeses(f.movimientos), []);
  assert.deepEqual(f.equipo, []);
});

test("agruparMeses sin movimientos da una lista vacía", () => {
  assert.deepEqual(agruparMeses({ ventas: [], pagos: [], otrosIngresos: [], egresos: [], nomina: [] }), []);
});
