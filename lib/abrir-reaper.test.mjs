// Pruebas de las opciones del botón "Abrir en REAPER" (Producción y sección REAPER).
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { opcionesRpp, enlaceReaper, haceCuanto } from "./abrir-reaper.ts";

const CARPETA = "X:\\REAPER Media\\LATINOGANG\\JUAN JOSE HUERTA GARCIA\\DE NEGRO";

test("un proyecto: arma la ruta completa del .rpp dentro de su carpeta", () => {
  const r = opcionesRpp([{ titulo: "DE NEGRO", album: null, inventario: { carpeta: CARPETA, proyectos: [{ archivo: "DE NEGRO.rpp", mtime: 10 }] } }]);
  assert.deepEqual(r, [{ ruta: `${CARPETA}\\DE NEGRO.rpp`, archivo: "DE NEGRO.rpp", mtime: 10, tema: null }]);
});

test("varios .rpp: el modificado más reciente va primero", () => {
  const r = opcionesRpp([{
    titulo: "DE NEGRO", album: null,
    inventario: { carpeta: CARPETA, proyectos: [
      { archivo: "viejo.rpp", mtime: 100 }, { archivo: "nuevo.rpp", mtime: 300 }, { archivo: "medio.rpp", mtime: 200 },
    ] },
  }]);
  assert.deepEqual(r.map((o) => o.archivo), ["nuevo.rpp", "medio.rpp", "viejo.rpp"]);
});

test("EP: junta los temas, cada uno con su nombre, y ordena entre todos", () => {
  const r = opcionesRpp([
    { titulo: "TEMA 1", album: "EL DISCO", inventario: { carpeta: "X:\\A\\EL DISCO\\TEMA 1", proyectos: [{ archivo: "TEMA 1.rpp", mtime: 5 }] } },
    { titulo: "TEMA 2", album: "EL DISCO", inventario: { carpeta: "X:\\A\\EL DISCO\\TEMA 2\\", proyectos: [{ archivo: "TEMA 2.rpp", mtime: 9 }] } },
  ]);
  assert.deepEqual(r.map((o) => [o.tema, o.ruta]), [
    ["TEMA 2", "X:\\A\\EL DISCO\\TEMA 2\\TEMA 2.rpp"],
    ["TEMA 1", "X:\\A\\EL DISCO\\TEMA 1\\TEMA 1.rpp"],
  ]);
});

test("sin escanear o sin carpeta no hay nada que ofrecer", () => {
  assert.deepEqual(opcionesRpp([{ titulo: "X", album: null, inventario: null }]), []);
  assert.deepEqual(opcionesRpp([{ titulo: "X", album: null, inventario: { carpeta: null, proyectos: [] } }]), []);
});

test("el enlace codifica la ruta (espacios, acentos y diagonales)", () => {
  assert.equal(
    enlaceReaper("X:\\REAPER Media\\JOSÉ\\A.rpp"),
    "arido-reaper://abrir?ruta=X%3A%5CREAPER%20Media%5CJOS%C3%89%5CA.rpp",
  );
});

test("hace cuánto: minutos, horas y días", () => {
  const ahora = 1_000_000_000_000;
  assert.equal(haceCuanto(ahora - 20_000, ahora), "hace un momento");
  assert.equal(haceCuanto(ahora - 5 * 60_000, ahora), "hace 5 min");
  assert.equal(haceCuanto(ahora - 3 * 3_600_000, ahora), "hace 3 h");
  assert.equal(haceCuanto(ahora - 26 * 3_600_000, ahora), "hace 1 día");
  assert.equal(haceCuanto(ahora - 4 * 86_400_000, ahora), "hace 4 días");
});
