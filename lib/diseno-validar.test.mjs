// Pruebas de la validación del catálogo de diseño. Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarDiseno } from "./diseno-validar.ts";

const actual = () => ({
  id: "cover-canvas", activo: true,
  datos: {
    grupo: "servicio", nombre: { es: "Portada + Canvas", en: "Cover + Canvas" },
    incluye: { es: ["Portada"], en: ["Cover"] }, precio: 700, costo: 500,
    unidad: { es: "pieza", en: "piece" }, componentes: [{ id: "cover-art" }, { id: "canvas" }], destacado: true,
  },
});
const cuerpo = (extra = {}) => ({
  nombre: { es: "Portada + Canvas", en: "Cover + Canvas" }, incluye: { es: ["Portada"], en: ["Cover"] },
  precio: 800, costo: 500, destacado: true, ...extra,
});

test("cambia precio y conserva grupo, unidad y componentes", () => {
  const r = validarDiseno(cuerpo(), actual(), true);
  assert.ok(r.ok);
  assert.equal(r.fila.datos.precio, 800);
  assert.equal(r.fila.datos.grupo, "servicio");
  assert.deepEqual(r.fila.datos.componentes, [{ id: "cover-art" }, { id: "canvas" }]);
  assert.deepEqual(r.fila.datos.unidad, { es: "pieza", en: "piece" });
});

test("quien no ve el costo no lo puede cambiar", () => {
  const r = validarDiseno(cuerpo({ costo: 1 }), actual(), false);
  assert.ok(r.ok);
  assert.equal(r.fila.datos.costo, 500);
});

test("rechaza costo mayor al precio", () => {
  assert.equal(validarDiseno(cuerpo({ precio: 400, costo: 500 }), actual(), true).ok, false);
});

test("rechaza precio cero, decimal o absurdo", () => {
  for (const precio of [0, 10.5, "x", 9_999_999]) {
    assert.equal(validarDiseno(cuerpo({ precio }), actual(), true).ok, false, String(precio));
  }
});

test("exige nombre e 'incluye' en español", () => {
  assert.equal(validarDiseno(cuerpo({ nombre: { es: " " } }), actual(), true).ok, false);
  assert.equal(validarDiseno(cuerpo({ incluye: { es: [] } }), actual(), true).ok, false);
});

test("las marcas desde/destacado sólo existen si están prendidas", () => {
  const r = validarDiseno(cuerpo({ destacado: false, desde: true }), actual(), true);
  assert.ok(r.ok);
  assert.equal("destacado" in r.fila.datos, false);
  assert.equal(r.fila.datos.desde, true);
});

test("sin 'activo' en el cuerpo se conserva el de antes", () => {
  const a = actual(); a.activo = false;
  const r = validarDiseno(cuerpo(), a, true);
  assert.ok(r.ok);
  assert.equal(r.fila.activo, false);
});
