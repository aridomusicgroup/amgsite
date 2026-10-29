// Pruebas de la validación del cuadro de opciones de render (silenciar canales).
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { leerOpciones } from "./render-opciones.ts";

const ID1 = "{E9F2C49E-24E1-435C-BDDF-0A954CB4ED95}";
const ID2 = "{3C8068A7-6FA0-4A74-9F2D-1446644F31BE}";

test("silenciar: acepta una lista de pistas con su id y nombre", () => {
  const r = leerOpciones({ silenciar: [{ id: ID1, nombre: "CHARCHETAS" }, { id: ID2, nombre: "C414" }] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.op.silenciar, [{ id: ID1, nombre: "CHARCHETAS" }, { id: ID2, nombre: "C414" }]);
});

test("silenciar: una lista vacía no deja rastro en las opciones", () => {
  const r = leerOpciones({ silenciar: [] });
  assert.equal(r.ok, true);
  assert.equal(r.op, null);
});

test("silenciar: un id repetido se guarda una sola vez", () => {
  const r = leerOpciones({ silenciar: [{ id: ID1, nombre: "A" }, { id: ID1.toLowerCase(), nombre: "A" }] });
  assert.equal(r.ok, true);
  assert.equal(r.op.silenciar.length, 1);
});

test("silenciar: rechaza lo que no sea una lista", () => {
  assert.equal(leerOpciones({ silenciar: "CHARCHETAS" }).ok, false);
  assert.equal(leerOpciones({ silenciar: { id: ID1 } }).ok, false);
});

test("silenciar: rechaza un id que no es un GUID de REAPER", () => {
  assert.equal(leerOpciones({ silenciar: [{ id: "CHARCHETAS", nombre: "CHARCHETAS" }] }).ok, false);
  assert.equal(leerOpciones({ silenciar: [{ id: "{1; DROP TABLE}", nombre: "x" }] }).ok, false);
  assert.equal(leerOpciones({ silenciar: [{ nombre: "sin id" }] }).ok, false);
});

test("silenciar: recorta el nombre y tolera que falte", () => {
  const largo = "X".repeat(500);
  const r = leerOpciones({ silenciar: [{ id: ID1, nombre: largo }, { id: ID2 }] });
  assert.equal(r.ok, true);
  assert.equal(r.op.silenciar[0].nombre.length, 120);
  assert.equal(r.op.silenciar[1].nombre, ID2);
});

test("silenciar: rechaza listas absurdamente largas", () => {
  const mil = Array.from({ length: 300 }, (_, i) => ({
    id: `{00000000-0000-0000-0000-${String(i).padStart(12, "0")}}`, nombre: `T${i}`,
  }));
  assert.equal(leerOpciones({ silenciar: mil }).ok, false);
});
