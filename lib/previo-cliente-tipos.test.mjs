// Pruebas de cuándo se pregunta "¿mandas previo al cliente?".
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { pasoDeMezcla } from "./previo-cliente-tipos.ts";

test("Mezclar y Masterizar disparan la pregunta, sin importar mayúsculas ni espacios", () => {
  assert.equal(pasoDeMezcla("Mezclar"), "Mezclar");
  assert.equal(pasoDeMezcla("  masterizar "), "Masterizar");
  assert.equal(pasoDeMezcla("MEZCLAR"), "Mezclar");
});

test("también 'Mezclar voces' (la mezcla de voces del cliente)", () => {
  assert.equal(pasoDeMezcla("Mezclar voces"), "Mezclar");
});

test("lo demás no pregunta nada", () => {
  assert.equal(pasoDeMezcla("Grabar Voces"), null);
  assert.equal(pasoDeMezcla("Editar y cuantizar"), null);
  assert.equal(pasoDeMezcla("Aprobada"), null);
  assert.equal(pasoDeMezcla("Subir a Drive"), null);
  assert.equal(pasoDeMezcla(""), null);
  assert.equal(pasoDeMezcla(null), null);
  assert.equal(pasoDeMezcla(undefined), null);
});

test("una palabra que sólo contiene 'mezcla' no cuenta", () => {
  assert.equal(pasoDeMezcla("Pedir mezcla de referencia"), null);
  assert.equal(pasoDeMezcla("Mezclador de pruebas"), null);
});
