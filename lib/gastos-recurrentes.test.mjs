// Pruebas de los avisos de pagos recurrentes. Dos cosas que NO deben pasar:
//  1) avisos fantasma cuando el proveedor está escrito distinto ("Paco" / "Paco Chávez");
//  2) callar un aviso verdadero porque otro pago "se parece".
// Ante la duda se prefiere avisar de más. Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import * as lib from "./gastos-recurrentes.ts";

const { detectarRecurrentes, combinarConRegistrados, pagosPendientes } = lib;

const egreso = (fecha, categoria, proveedor, total_mxn = 3500, extra = {}) => ({
  fecha, categoria, proveedor, descripcion: null, total_mxn, es_capex: false, ...extra,
});

const registro = (nombre, categoria, proveedor, diaMes, extra = {}) => ({
  id: `r-${nombre}`, nombre, categoria, proveedor, montoEstimado: 3500, diaMes, cadaMeses: 1, activo: true, ...extra,
});

const registroPaco = registro("Mensualidad estudio", "Renta Estudio", "Paco", 1);

// Lo que pasó de verdad: mayo-julio se capturaron como "Paco Chávez", agosto en adelante como "Paco".
const historialRenta = [
  egreso("2026-05-01", "Renta Estudio", "Paco Chávez"),
  egreso("2026-06-01", "Renta Estudio", "Paco Chávez"),
  egreso("2026-07-01", "Renta Estudio", "Paco Chávez "),
  egreso("2026-08-01", "Renta Estudio", "Paco"),
  egreso("2026-09-03", "Renta Estudio", "Paco "),
  egreso("2026-10-01", "Renta Estudio", "Paco"),
];
const HOY = "2026-10-24";
const pendientesDe = (registrados, egresos) => pagosPendientes(combinarConRegistrados(registrados, egresos, HOY), HOY, 5);
const resumen = (rs) => rs.map((r) => [r.etiqueta, r.vecesVisto, r.proximaFecha]);
const alertas = (ps) => ps.map((p) => [p.etiqueta, p.proximaFecha]);

// ── El fantasma de la renta ────────────────────────────────────────────────

test("fantasma de la renta: con el registro de 'Paco' ya no queda nada pendiente", () => {
  assert.deepEqual(pendientesDe([registroPaco], historialRenta), []);
});

test("fantasma de la renta: solo existe UN gasto de renta y le toca el 1 de noviembre", () => {
  const rentas = combinarConRegistrados([registroPaco], historialRenta, HOY).filter((r) => /renta estudio/i.test(r.etiqueta));
  assert.equal(rentas.length, 1);
  assert.equal(rentas[0].origen, "explicito");
  assert.equal(rentas[0].ultimaFecha, "2026-10-01");
  assert.equal(rentas[0].proximaFecha, "2026-11-01");
});

test("sin registro a mano: la serie vieja se retira porque otra con nombre parecido la sucedió", () => {
  const recurrentes = detectarRecurrentes(historialRenta);
  assert.deepEqual(resumen(recurrentes), [["Renta Estudio · Paco", 3, "2026-11-01"]]);
  assert.deepEqual(pagosPendientes(recurrentes, HOY, 5), []);
});

test("registro 'Paco' y el pago nuevo capturado como 'Paco Chávez' (mismo monto): sí cuenta como pagado", () => {
  const egresos = [...historialRenta.slice(0, 5), egreso("2026-10-01", "Renta Estudio", "Paco Chávez")];
  assert.deepEqual(pendientesDe([registroPaco], egresos), []);
  assert.equal(lib.ultimasPagadas([registroPaco], egresos).get(registroPaco.id), "2026-10-01");
});

test("el pago con otro nombre y OTRO monto no cuenta: no se adivina", () => {
  const egresos = [...historialRenta.slice(0, 5), egreso("2026-10-01", "Renta Estudio", "Paco Chávez", 900)];
  assert.deepEqual(alertas(pendientesDe([registroPaco], egresos)), [["Renta Estudio · Paco", "2026-10-01"]]);
});

test("un atraso de verdad SÍ avisa (el arreglo no apaga los avisos)", () => {
  const pendientes = pendientesDe([registroPaco], historialRenta.slice(0, 5)); // último pago: 3 de septiembre
  assert.equal(pendientes.length, 1);
  assert.equal(pendientes[0].proximaFecha, "2026-10-01");
});

test("el resultado no depende del orden en que lleguen los egresos", () => {
  const barajado = [3, 0, 5, 1, 4, 2].map((i) => historialRenta[i]);
  for (const orden of [[...historialRenta].reverse(), barajado]) {
    assert.deepEqual(resumen(detectarRecurrentes(orden)), resumen(detectarRecurrentes(historialRenta)));
    assert.deepEqual(
      resumen(combinarConRegistrados([registroPaco], orden, HOY)),
      resumen(combinarConRegistrados([registroPaco], historialRenta, HOY)),
    );
  }
});

// ── No callar avisos verdaderos (hallazgos de las dos revisiones) ───────────

test("'Luz' registrada y sin pagar NO se da por pagada con una compra de 'foco de luz'", () => {
  const luz = registro("Luz", "Servicios", null, 20);
  const foco = { fecha: "2026-10-10", categoria: "Servicios", proveedor: null, descripcion: "Foco de luz LED para cabina", total_mxn: 80, es_capex: false };
  assert.deepEqual(pendientesDe([luz], [foco]).map((p) => p.proximaFecha), ["2026-10-20"]);
});

test("'Agua' registrada y sin pagar NO se da por pagada con un garrafón de agua", () => {
  const agua = registro("Agua", "Servicios", null, 15);
  const garrafon = { fecha: "2026-10-05", categoria: "Servicios", proveedor: null, descripcion: "Garrafon de agua para el estudio", total_mxn: 45, es_capex: false };
  assert.equal(pendientesDe([agua], [garrafon]).length, 1);
});

test("'Luz' pagada con el botón y luego una compra a 'Luz Led SA': sigue avisando", () => {
  const luz = registro("Luz", "Servicios", null, 20);
  const egresos = [egreso("2026-08-20", "Servicios", "Luz", 4112), egreso("2026-10-01", "Servicios", "Luz Led SA", 80)];
  assert.deepEqual(pendientesDe([luz], egresos).map((p) => p.proximaFecha), ["2026-09-20"]);
});

const googleOne = (fecha, monto = 390) => egreso(fecha, "Servicios", "Google One", monto);
const workspace = (fecha) => egreso(fecha, "Servicios", "Google Workspace", 600);
const trimestreGoogleOne = [googleOne("2026-07-05"), googleOne("2026-08-05"), googleOne("2026-09-05")]; // octubre sin pagar

test("un pago suelto a 'Google' (1 de octubre) NO apaga el aviso de Google One", () => {
  const egresos = [...trimestreGoogleOne, egreso("2026-10-01", "Servicios", "Google", 100)];
  assert.deepEqual(alertas(pagosPendientes(detectarRecurrentes(egresos), HOY, 5)), [["Servicios · Google One", "2026-10-05"]]);
});

test("un pago suelto a 'Google' en septiembre NO tumba la serie ni el aviso de Google One", () => {
  const egresos = [...trimestreGoogleOne, egreso("2026-09-12", "Servicios", "Google", 100)];
  assert.deepEqual(alertas(pagosPendientes(detectarRecurrentes(egresos), HOY, 5)), [["Servicios · Google One", "2026-10-05"]]);
});

test("un pago suelto a 'Google' no junta Google One con Google Workspace", () => {
  const egresos = [
    ...trimestreGoogleOne,
    workspace("2026-07-20"), workspace("2026-08-20"), workspace("2026-09-20"), workspace("2026-10-20"),
    egreso("2026-09-12", "Servicios", "Google", 100),
  ];
  assert.deepEqual(alertas(pagosPendientes(detectarRecurrentes(egresos), HOY, 5)), [["Servicios · Google One", "2026-10-05"]]);
});

test("una compra suelta 'Vercel Pro upgrade' NO apaga el aviso de Vercel", () => {
  const egresos = [
    egreso("2026-07-07", "Servicios", "Vercel", 338), egreso("2026-08-07", "Servicios", "Vercel", 338), egreso("2026-09-07", "Servicios", "Vercel", 338),
    egreso("2026-10-01", "Servicios", "Vercel Pro upgrade", 600),
  ];
  assert.deepEqual(alertas(pagosPendientes(detectarRecurrentes(egresos), HOY, 5)), [["Servicios · Vercel", "2026-10-07"]]);
});

test("registro 'Google' (día 20) sin pagar y el primer pago a 'Google One' por otro monto: sigue avisando", () => {
  const google = registro("Google", "Servicios", "Google", 20);
  assert.deepEqual(pendientesDe([google], [googleOne("2026-10-05")]).map((p) => p.proximaFecha), ["2026-10-20"]);
});

test("un registro pausado de 'Google' NO esconde la serie de Google One sin pagar", () => {
  const pausado = registro("Google", "Servicios", "Google", 20, { activo: false });
  assert.deepEqual(alertas(pendientesDe([pausado], trimestreGoogleOne)), [["Servicios · Google One", "2026-10-05"]]);
});

test("si un pago con otro nombre cuadra con DOS registros, no se le da a ninguno", () => {
  const google = registro("Google", "Servicios", "Google", 7, { montoEstimado: 500 });
  const unoRegistrado = registro("Google One", "Servicios", "Google One", 7, { montoEstimado: 500 });
  const almacenamiento = egreso("2026-10-05", "Servicios", "Google One Storage", 500);
  const ultimas = lib.ultimasPagadas([google, unoRegistrado], [almacenamiento]);
  assert.equal(ultimas.get(google.id), null);
  assert.equal(ultimas.get(unoRegistrado.id), null);
  // con un solo registro que cuadre, sí cuenta
  assert.equal(lib.ultimasPagadas([unoRegistrado], [almacenamiento]).get(unoRegistrado.id), "2026-10-05");
});

test("'Plan A' y 'Plan A+' son planes distintos aunque solo cambie un signo", () => {
  const plan = (fecha, nombre, monto) => egreso(fecha, "Suscripciones", nombre, monto);
  const egresos = [
    plan("2026-07-03", "Plan A", 100), plan("2026-08-03", "Plan A", 100), plan("2026-09-03", "Plan A", 100), plan("2026-10-03", "Plan A", 100),
    plan("2026-07-20", "Plan A+", 180), plan("2026-08-20", "Plan A+", 180), plan("2026-09-20", "Plan A+", 180), // octubre sin pagar
  ];
  assert.deepEqual(alertas(pagosPendientes(detectarRecurrentes(egresos), HOY, 5)), [["Suscripciones · Plan A+", "2026-10-20"]]);
});

// ── La sucesión no retira una serie con un pago de otro monto (tercera revisión) ──

test("un registro 'Google' con UN pago de $100 NO retira la serie de Google One de $390", () => {
  const google = registro("Google", "Servicios", "Google", 20, { montoEstimado: 600 });
  const egresos = [...trimestreGoogleOne, egreso("2026-10-01", "Servicios", "Google", 100)];
  assert.deepEqual(alertas(pendientesDe([google], egresos)).filter(([e]) => /Google One/.test(e)), [["Servicios · Google One", "2026-10-05"]]);
});

test("un registro 'Google' con su primer pago legítimo de $600 tampoco retira a Google One", () => {
  const google = registro("Google", "Servicios", "Google", 20, { montoEstimado: 600 });
  const egresos = [...trimestreGoogleOne, egreso("2026-10-01", "Servicios", "Google", 600)];
  assert.deepEqual(alertas(pendientesDe([google], egresos)).filter(([e]) => /Google One/.test(e)), [["Servicios · Google One", "2026-10-05"]]);
});

test("un 'Amazon Prime' anual de $1099 NO retira la serie mensual de 'Amazon' de $199", () => {
  const prime = registro("Amazon Prime", "Suscripciones", "Amazon Prime", 3, { montoEstimado: 1099, cadaMeses: 12 });
  const amazon = (fecha) => egreso(fecha, "Suscripciones", "Amazon", 199);
  const egresos = [amazon("2026-07-12"), amazon("2026-08-12"), amazon("2026-09-12"), egreso("2026-10-03", "Suscripciones", "Amazon Prime", 1099)];
  assert.deepEqual(alertas(pendientesDe([prime], egresos)), [["Suscripciones · Amazon", "2026-10-12"]]);
});

test("dos cargos sueltos a 'Google' ($50 y $80) forman una serie pero no retiran a Google One", () => {
  const egresos = [...trimestreGoogleOne, egreso("2026-10-03", "Servicios", "Google", 50), egreso("2026-10-31", "Servicios", "Google", 80)];
  const alertasNov = pagosPendientes(detectarRecurrentes(egresos), "2026-11-02", 5).map((p) => [p.etiqueta, p.proximaFecha]);
  assert.deepEqual(alertasNov, [["Servicios · Google One", "2026-10-05"]]);
});

test("un registro PAUSADO con estimado parecido ya no se traga la serie de Google One", () => {
  const pausado = registro("Google", "Servicios", "Google", 20, { activo: false, montoEstimado: 390 });
  assert.deepEqual(alertas(pendientesDe([pausado], trimestreGoogleOne)), [["Servicios · Google One", "2026-10-05"]]);
});

test("el cambio de nombre puede compartir UN mes (el del relevo) y aun así retira al fantasma", () => {
  const egresos = [
    egreso("2026-05-01", "Renta Estudio", "Paco Chávez"), egreso("2026-06-01", "Renta Estudio", "Paco Chávez"), egreso("2026-07-01", "Renta Estudio", "Paco Chávez"),
    egreso("2026-07-30", "Renta Estudio", "Paco"), egreso("2026-08-30", "Renta Estudio", "Paco"), egreso("2026-09-30", "Renta Estudio", "Paco"),
  ];
  assert.deepEqual(pagosPendientes(detectarRecurrentes(egresos), "2026-10-02", 5), []);
});

test("un pago de 'Paco' capturado después con fecha de junio no resucita el fantasma", () => {
  const conRetro = [...historialRenta, egreso("2026-06-15", "Renta Estudio", "Paco")];
  assert.deepEqual(pagosPendientes(detectarRecurrentes(conRetro), HOY, 5), []);
});

test("la clave de un gasto no cambia cuando una variante de acentos se mezcla con la primera", () => {
  const egresos = [egreso("2026-08-05", "Servicios", "Música", 200), egreso("2026-09-05", "Servicios", "Música", 200), egreso("2026-10-05", "Servicios", "Musica", 200)];
  const [r] = detectarRecurrentes(egresos);
  assert.equal(r.clave, "servicios::música");
});

test("un egreso ajeno a 'Paco López' no resucita el fantasma de la renta", () => {
  const conAjeno = [...historialRenta, egreso("2026-10-12", "Renta Estudio", "Paco López", 100)];
  assert.deepEqual(pendientesDe([registroPaco], conAjeno), []);
  assert.deepEqual(pagosPendientes(detectarRecurrentes(conAjeno), HOY, 5), []);
});

test("Apple Music y Apple iCloud no se mezclan por un pago a 'Apple', en cualquier orden", () => {
  const egresos = [
    egreso("2026-09-01", "Suscripciones", "Apple Music", 129),
    egreso("2026-09-01", "Suscripciones", "Apple iCloud", 49),
    egreso("2026-09-01", "Suscripciones", "Apple", 10),
    egreso("2026-10-01", "Suscripciones", "Apple Music", 129),
    egreso("2026-10-01", "Suscripciones", "Apple iCloud", 49),
  ];
  const esperado = [["Suscripciones · Apple Music", 2, "2026-11-01"], ["Suscripciones · Apple iCloud", 2, "2026-11-01"]];
  const ordenado = (rs) => resumen(rs).sort((a, b) => a[0].localeCompare(b[0])).reverse();
  assert.deepEqual(ordenado(detectarRecurrentes(egresos)), esperado);
  assert.deepEqual(ordenado(detectarRecurrentes([...egresos].reverse())), esperado);
});

test("'Paco' que cuadra con dos apellidos distintos no los junta ni los retira", () => {
  const egresos = [
    egreso("2026-06-01", "Renta Estudio", "Paco"),
    egreso("2026-07-01", "Renta Estudio", "Paco López"),
    egreso("2026-08-01", "Renta Estudio", "Paco López"),
    egreso("2026-09-01", "Renta Estudio", "Paco Chávez"),
    egreso("2026-10-01", "Renta Estudio", "Paco Chávez"),
  ];
  const etiquetas = resumen(detectarRecurrentes(egresos)).map(([e, veces]) => [e, veces]).sort();
  assert.deepEqual(etiquetas, [["Renta Estudio · Paco Chávez", 2], ["Renta Estudio · Paco López", 2]]);
});

test("límite conocido: una escritura que no contiene al nombre ('Paco renta') no se retira", () => {
  const egresos = [
    egreso("2026-06-01", "Renta Estudio", "Paco Chávez"),
    egreso("2026-07-01", "Renta Estudio", "Paco Chávez"),
    egreso("2026-08-01", "Renta Estudio", "Paco renta"),
    egreso("2026-09-01", "Renta Estudio", "Paco renta"),
  ];
  assert.equal(detectarRecurrentes(egresos).length, 2);
});

test("nombres de puros símbolos o de otro alfabeto no se confunden entre sí ni con un nombre vacío", () => {
  const r = registro("X", "Otros", "日本", 5);
  const egresos = [egreso("2026-10-02", "Otros", "-"), egreso("2026-10-03", "Otros", "")];
  assert.equal(lib.ultimasPagadas([r], egresos).get(r.id), null);
  assert.equal(lib.ultimasPagadas([r], [egreso("2026-10-04", "Otros", "日本")]).get(r.id), "2026-10-04");
});

// ── Lo que ya funcionaba ───────────────────────────────────────────────────

test("gastos distintos de la misma categoría siguen separados", () => {
  const egresos = [
    egreso("2026-09-07", "Servicios", "Vercel", 338),
    egreso("2026-10-07", "Servicios", "Vercel", 338),
    egreso("2026-09-18", "Servicios", "Railway", 90),
    egreso("2026-10-18", "Servicios", "Railway", 90),
  ];
  assert.deepEqual(detectarRecurrentes(egresos).map((r) => r.etiqueta).sort(), ["Servicios · Railway", "Servicios · Vercel"]);
});

test("un registro pausado sigue tapando la inferencia de su propio gasto, aunque se escriba distinto", () => {
  const pausado = { ...registroPaco, activo: false };
  assert.deepEqual(combinarConRegistrados([pausado], historialRenta, HOY), []);
});

test("sigue ignorando equipo, gastos de una sola vez y los que no son mensuales", () => {
  const egresos = [
    egreso("2026-08-04", "Equipo", "Amazon", 1208.5, { es_capex: true }),
    egreso("2026-09-04", "Equipo", "Amazon", 1208.5, { es_capex: true }),
    egreso("2026-09-08", "Servicios", "Beatstars", 530),
    egreso("2026-06-20", "Servicios", "CFE", 4112),
    egreso("2026-08-19", "Servicios", "CFE", 4112), // 60 días: bimestral, no mensual
  ];
  assert.deepEqual(detectarRecurrentes(egresos), []);
});

test("rinde con el volumen del cron: 2000 egresos, 400 proveedores y 40 registros", () => {
  const egresos = [];
  for (let i = 0; i < 2000; i++) {
    const mes = String((i % 9) + 1).padStart(2, "0");
    egresos.push(egreso(`2026-${mes}-${String((i % 27) + 1).padStart(2, "0")}`, `Cat ${i % 7}`, `Proveedor ${i % 400}`, 100));
  }
  const registrados = Array.from({ length: 40 }, (_, i) => registro(`Gasto ${i}`, `Cat ${i % 7}`, `Proveedor ${i}`, 10));
  const t0 = performance.now();
  combinarConRegistrados(registrados, egresos, HOY);
  assert.ok(performance.now() - t0 < 500, "tardó demasiado");
});
