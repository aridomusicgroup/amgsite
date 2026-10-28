// Pruebas del aviso al quitar a alguien que viene de las variables de entorno.
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { variablesDelEntorno, avisoEnEntorno } from "./usuarios-entorno.ts";

test("un correo en PRODUCCION_EMAILS devuelve esa variable", () => {
  const env = { ADMIN_EMAILS: "dueno@arido.mx", PRODUCCION_EMAILS: "leo@arido.mx,otro@arido.mx" };
  assert.deepEqual(variablesDelEntorno("leo@arido.mx", env), ["PRODUCCION_EMAILS"]);
});

test("no importan mayúsculas ni espacios, ni en el correo ni en la lista", () => {
  const env = { CRM_EMAILS: " Ana@Arido.MX , leo@arido.mx " };
  assert.deepEqual(variablesDelEntorno("  LEO@arido.mx ", env), ["CRM_EMAILS"]);
  assert.deepEqual(variablesDelEntorno("ana@arido.mx", env), ["CRM_EMAILS"]);
});

test("si está en varias variables las devuelve todas, en el orden admin, crm, produccion", () => {
  const env = { PRODUCCION_EMAILS: "leo@arido.mx", ADMIN_EMAILS: "leo@arido.mx", CRM_EMAILS: "leo@arido.mx" };
  assert.deepEqual(variablesDelEntorno("leo@arido.mx", env), ["ADMIN_EMAILS", "CRM_EMAILS", "PRODUCCION_EMAILS"]);
});

test("quien no está en ninguna variable devuelve lista vacía", () => {
  const env = { ADMIN_EMAILS: "dueno@arido.mx", CRM_EMAILS: "ana@arido.mx", PRODUCCION_EMAILS: "otro@arido.mx" };
  assert.deepEqual(variablesDelEntorno("leo@arido.mx", env), []);
});

test("variables ausentes, vacías o con comas sueltas no rompen nada", () => {
  assert.deepEqual(variablesDelEntorno("leo@arido.mx", {}), []);
  assert.deepEqual(variablesDelEntorno("leo@arido.mx", { ADMIN_EMAILS: "", CRM_EMAILS: " , ,", PRODUCCION_EMAILS: undefined }), []);
});

test("un correo parecido no cuenta: se compara el correo completo", () => {
  const env = { PRODUCCION_EMAILS: "aleo@arido.mx,leo@arido.mx.mx" };
  assert.deepEqual(variablesDelEntorno("leo@arido.mx", env), []);
});

test("un correo vacío nunca coincide, aunque la lista tenga huecos", () => {
  assert.deepEqual(variablesDelEntorno("", { ADMIN_EMAILS: "a@arido.mx,,b@arido.mx" }), []);
});

test("el aviso nombra el correo, la variable y las dos salidas", () => {
  const aviso = avisoEnEntorno("leo@arido.mx", ["PRODUCCION_EMAILS"]);
  assert.match(aviso, /leo@arido\.mx/);
  assert.match(aviso, /la variable PRODUCCION_EMAILS/);
  assert.match(aviso, /Inactivo/);
  assert.match(aviso, /Vercel/);
});

test("con varias variables el aviso las nombra todas, en plural", () => {
  const aviso = avisoEnEntorno("leo@arido.mx", ["ADMIN_EMAILS", "CRM_EMAILS"]);
  assert.match(aviso, /las variables ADMIN_EMAILS y CRM_EMAILS/);
});
