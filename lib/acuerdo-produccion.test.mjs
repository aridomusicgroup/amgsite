// Pruebas del acuerdo individual de producción (módulo puro).
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACUERDO_PRODUCCION_SEED,
  PLAZO_CESION_DEFAULT,
  debeBloquearProduccion,
  fechaLarga,
  huecosSinResolver,
  renderProduccion,
  tituloDeProduccion,
} from "./acuerdos/produccion.ts";

const VARS = { folio: "COT-0101", fecha_cotizacion: "10 de noviembre de 2026", titulo: "Mezcla de EP" };

test("rellena todo menos {{cliente}}, que se pone al firmar", () => {
  const out = renderProduccion(ACUERDO_PRODUCCION_SEED.cuerpo, VARS);
  assert.match(out, /cotización COT-0101 de fecha 10 de noviembre de 2026/);
  assert.match(out, /\{\{cliente\}\}/);
  assert.deepEqual(huecosSinResolver(out), []);
});

test("sin rondas ni plazo en la cotización usa los valores por defecto", () => {
  const out = renderProduccion(ACUERDO_PRODUCCION_SEED.cuerpo, VARS);
  assert.match(out, new RegExp(`por el plazo de ${PLAZO_CESION_DEFAULT}`));
  assert.match(out, /incluye 2 rondas de revisión/);
});

test("lo que la cotización sí dice reemplaza al valor por defecto", () => {
  const out = renderProduccion(ACUERDO_PRODUCCION_SEED.cuerpo, { ...VARS, rondas_revision: "3", plazo_cesion: "diez años" });
  assert.match(out, /por el plazo de diez años/);
  assert.match(out, /incluye 3 rondas/);
});

test("un hueco inventado en una plantilla editada se detecta antes de mandar el enlace", () => {
  const editado = ACUERDO_PRODUCCION_SEED.cuerpo + "\n\n23. Descuento especial: {{descuento_vip}}.";
  const out = renderProduccion(editado, VARS);
  assert.deepEqual(huecosSinResolver(out), ["descuento_vip"]);
});

test("la plantilla de código no deja huecos propios sin variable", () => {
  const huecos = huecosSinResolver(ACUERDO_PRODUCCION_SEED.cuerpo);
  assert.deepEqual(huecos.sort(), ["fecha_cotizacion", "folio", "plazo_cesion", "rondas_revision", "titulo"]);
});

test("el título de la producción une los conceptos y nunca queda vacío", () => {
  assert.equal(tituloDeProduccion([{ label: "Mezcla" }, { label: " Master " }], "COT-1"), "Mezcla + Master");
  assert.equal(tituloDeProduccion([], "COT-1"), "la producción de la cotización COT-1");
  assert.equal(tituloDeProduccion([{ label: "" }, {}], "COT-1"), "la producción de la cotización COT-1");
  assert.ok(tituloDeProduccion([{ label: "x".repeat(300) }], "COT-1").length <= 140);
});

test("la fecha larga no depende de la zona horaria", () => {
  assert.equal(fechaLarga(new Date("2026-11-10T03:00:00Z")), "10 de noviembre de 2026");
  assert.equal(fechaLarga(new Date("2026-01-01T00:00:00Z")), "1 de enero de 2026");
});

test("solo bloquea si pidió acuerdo individual y aún no firma", () => {
  assert.equal(debeBloquearProduccion({ acuerdoIndividual: true, firmado: false }), true);
  assert.equal(debeBloquearProduccion({ acuerdoIndividual: true, firmado: true }), false);
  assert.equal(debeBloquearProduccion({ acuerdoIndividual: false, firmado: false }), false);
});
