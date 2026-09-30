// Pruebas de la validación del catálogo del cotizador. Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarServicio, slug } from "./servicios-validar.ts";

const extras = new Set(["trombon", "tololoche"]);

test("slug quita acentos y símbolos", () => {
  assert.equal(slug("Violín Norteño!"), "violin-norteno");
});

test("un extra nuevo toma su id del nombre y graba por defecto", () => {
  const r = validarServicio("extra", { label: { es: "Violín" }, price: 800 }, extras);
  assert.ok(r.ok);
  assert.equal(r.fila.id, "violin");
  assert.equal(r.fila.datos.graba, true);
  assert.deepEqual(r.fila.datos.label, { es: "Violín", en: "Violín" });
});

test("al editar el id no cambia aunque cambie el nombre", () => {
  const r = validarServicio("extra", { label: { es: "Trombón de vara" }, price: 700 }, extras, "trombon");
  assert.ok(r.ok);
  assert.equal(r.fila.id, "trombon");
});

test("rechaza precios cero, negativos, decimales y absurdos", () => {
  for (const price of [0, -5, 10.5, "abc", 5_000_000]) {
    assert.equal(validarServicio("extra", { label: { es: "X" }, price }, extras).ok, false, String(price));
  }
});

test("exige el nombre en español", () => {
  assert.equal(validarServicio("studio", { label: { es: " " }, price: 100 }, extras).ok, false);
});

test("un paquete no puede incluir un instrumento que no existe", () => {
  const r = validarServicio("base", { name: { es: "P" }, price: 5000, includedExtras: ["kazoo"] }, extras);
  assert.equal(r.ok, false);
});

test("un paquete válido conserva sus opciones y sus instrumentos incluidos", () => {
  const r = validarServicio("base", {
    name: { es: "Paquete Nuevo" }, price: 7000,
    includes: { es: ["Armonía", "Mezcla y master"], en: ["Harmony", "Mix & master"] },
    includedExtras: ["trombon"],
    choices: [{ label: { es: "Tu armonía" }, options: [{ label: { es: "Guitarra" } }, { label: { es: "Bajoquinto" } }] }],
  }, extras);
  assert.ok(r.ok);
  assert.equal(r.fila.datos.choices[0].options[1].id, "bajoquinto");
  assert.deepEqual(r.fila.datos.includedExtras, ["trombon"]);
});

test("una opción necesita al menos dos alternativas", () => {
  const r = validarServicio("base", {
    name: { es: "P" }, price: 5000,
    choices: [{ label: { es: "Bajo" }, options: [{ label: { es: "Bass" } }] }],
  }, extras);
  assert.equal(r.ok, false);
});

test("sólo 'Desde cero' puede tener precio 0", () => {
  assert.equal(validarServicio("base", { name: { es: "Desde cero" }, price: 0 }, extras, "scratch").ok, true);
  assert.equal(validarServicio("base", { name: { es: "Otro" }, price: 0 }, extras).ok, false);
});

test("un extra puede marcarse sin grabación", () => {
  const r = validarServicio("extra", { label: { es: "Arreglo" }, price: 500, graba: false }, extras);
  assert.ok(r.ok);
  assert.equal(r.fila.datos.graba, false);
});
