// Pruebas de qué licencia (y qué archivos) le tocan a un renglón de un pedido.
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import licencias from "../data/licenses.json" with { type: "json" };
import { licenciaDeRenglonPuro, licenciaPorMontoPuro } from "./licencia-renglon.ts";

const EX = 600;

test("pedido viejo: la licencia se deduce del monto de siempre", () => {
  assert.deepEqual(licenciaPorMontoPuro(25, licencias, EX), { files: ["MP3"], exclusive: false });
  assert.deepEqual(licenciaPorMontoPuro(50, licencias, EX).files?.sort(), ["MP3", "WAV"]);
  assert.equal(licenciaPorMontoPuro(600, licencias, EX).exclusive, true);
});

test("pedido viejo con monto raro: no se adivina (carpeta general)", () => {
  assert.deepEqual(licenciaPorMontoPuro(70, licencias, EX), { files: null, exclusive: false });
});

test("con license_id guardado manda la licencia, no el monto", () => {
  // Un Premium con precio propio de $70: por monto no se reconocería.
  assert.deepEqual(licenciaDeRenglonPuro({ amount: 70, license_id: "premium" }, licencias, EX).files?.sort(), ["MP3", "WAV"]);
  // Una exclusiva a $400: por monto sería "nada"; guardada, es exclusiva.
  assert.deepEqual(licenciaDeRenglonPuro({ amount: 400, license_id: "exclusive" }, licencias, EX), { files: null, exclusive: true });
  // Un Basic caro NO se vuelve exclusiva por pasar de $600.
  assert.deepEqual(licenciaDeRenglonPuro({ amount: 650, license_id: "basic" }, licencias, EX), { files: ["MP3"], exclusive: false });
});

test("license_id desconocido o vacío cae al monto", () => {
  assert.deepEqual(licenciaDeRenglonPuro({ amount: 25, license_id: "inventada" }, licencias, EX), { files: ["MP3"], exclusive: false });
  assert.deepEqual(licenciaDeRenglonPuro({ amount: 25, license_id: null }, licencias, EX), { files: ["MP3"], exclusive: false });
});
