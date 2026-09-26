// Pruebas de cómo se liga una venta a un beat por su nombre.
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { nombreBeat, ventaEsDelBeat } from "./beat-nombre.ts";

const CRUDO = "\"LAGRIMA$\" JUNIOR H TYPE BEAT";
const LIMPIO = "LAGRIMA$ JUNIOR H TYPE BEAT";

test("el nombre corto sale de las comillas o de lo que va antes de 'type'", () => {
  assert.equal(nombreBeat(CRUDO), "lagrima$");
  assert.equal(nombreBeat("“Champagne” Oscar Maydon x Junior H"), "champagne");
  assert.equal(nombreBeat("SOLO TU Prod. Arido"), "solo tu");
});

test("liga la venta de BeatStars (nombre corto) y la web (título completo)", () => {
  assert.equal(ventaEsDelBeat("LAGRIMA$", CRUDO, LIMPIO), true);
  assert.equal(ventaEsDelBeat("Lágrima$", CRUDO, LIMPIO), true); // ni acentos ni mayúsculas importan
  assert.equal(ventaEsDelBeat("LAGRIMA", CRUDO, LIMPIO), false); // la $ sí es parte del nombre
  assert.equal(ventaEsDelBeat(LIMPIO, CRUDO, LIMPIO), true);
});

test("una venta web con varios beats los trae unidos por ' | '", () => {
  assert.equal(ventaEsDelBeat(`MORRAS TYPE BEAT | ${LIMPIO} | Comisión por pago internacional`, CRUDO, LIMPIO), true);
});

test("'SOLO' no se lleva las ventas de 'SOLO TU'", () => {
  assert.equal(ventaEsDelBeat("SOLO TU", "\"SOLO\" TYPE BEAT", "SOLO TYPE BEAT"), false);
  assert.equal(ventaEsDelBeat("SOLO", "\"SOLO\" TYPE BEAT", "SOLO TYPE BEAT"), true);
});

test("sin nombre de venta no liga nada", () => {
  assert.equal(ventaEsDelBeat(null, CRUDO, LIMPIO), false);
  assert.equal(ventaEsDelBeat("", CRUDO, LIMPIO), false);
});
