// Pruebas de la selección de canales a silenciar (carpeta → sus hijas).
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { hijasDe, alternarSilencio } from "./silenciar-pistas.ts";

// BATERIA (carpeta) › BOMBO, CAJA › ARMONÍA (subcarpeta) › C414 ; suelta: BAJO ; LINE ya silenciada
const pistas = [
  { id: "{1}", nombre: "BATERIA", profundidad: 0, silenciada: false },
  { id: "{2}", nombre: "BOMBO", profundidad: 1, silenciada: false },
  { id: "{3}", nombre: "CAJA", profundidad: 1, silenciada: false },
  { id: "{4}", nombre: "ARMONÍA", profundidad: 1, silenciada: false },
  { id: "{5}", nombre: "C414", profundidad: 2, silenciada: false },
  { id: "{6}", nombre: "BAJO", profundidad: 0, silenciada: false },
  { id: "{7}", nombre: "LINE", profundidad: 0, silenciada: true },
];

test("hijasDe: una carpeta arrastra todo lo que va más adentro, hasta volver a su nivel", () => {
  assert.deepEqual(hijasDe(pistas, 0), [1, 2, 3, 4]);
  assert.deepEqual(hijasDe(pistas, 3), [4]);
});

test("hijasDe: una pista suelta o la última no tienen hijas", () => {
  assert.deepEqual(hijasDe(pistas, 5), []);
  assert.deepEqual(hijasDe(pistas, 6), []);
  assert.deepEqual(hijasDe(pistas, 4), []);
});

test("alternarSilencio: elegir una carpeta marca también todas sus hijas", () => {
  const sel = alternarSilencio(new Set(), pistas, 0);
  assert.deepEqual([...sel].sort(), ["{1}", "{2}", "{3}", "{4}", "{5}"]);
});

test("alternarSilencio: volver a picarle a la carpeta las desmarca a todas", () => {
  const marcada = alternarSilencio(new Set(), pistas, 0);
  assert.equal(alternarSilencio(marcada, pistas, 0).size, 0);
});

test("alternarSilencio: una hija se marca y desmarca sola, sin tocar a su carpeta", () => {
  const una = alternarSilencio(new Set(), pistas, 1);
  assert.deepEqual([...una], ["{2}"]);
  assert.equal(alternarSilencio(una, pistas, 1).size, 0);
});

test("alternarSilencio: una pista ya silenciada en el proyecto no se puede elegir", () => {
  assert.equal(alternarSilencio(new Set(), pistas, 6).size, 0);
});

test("alternarSilencio: una pista sin id (inventario viejo) no se puede elegir", () => {
  const sinId = [{ id: undefined, nombre: "X", profundidad: 0, silenciada: false }];
  assert.equal(alternarSilencio(new Set(), sinId, 0).size, 0);
});

test("alternarSilencio: no modifica el conjunto que recibe", () => {
  const original = new Set(["{6}"]);
  const nuevo = alternarSilencio(original, pistas, 0);
  assert.deepEqual([...original], ["{6}"]);
  assert.equal(nuevo.has("{6}"), true);
  assert.notEqual(nuevo, original);
});
