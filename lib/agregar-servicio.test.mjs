// Pruebas del enlace "Agregar servicio" (de un proyecto entregado al cotizador).
// Node 24 corre el .ts directo. Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { urlAgregarServicio, precargaDeUrl, itemsDePrecarga, SERVICIO_MEZCLA_VOCES } from "./agregar-servicio.ts";

const parametros = (url) => {
  const q = new URL(url, "https://x.test").searchParams;
  return (k) => q.get(k);
};
const existe = { cliente: (id) => id === "c-juan", proyecto: (id) => id === "p-dea2" };

const catalogo = (activo = true) => ({
  currency: "MXN",
  bases: [],
  extras: [],
  studio: [{ id: "mezcla-voces", label: { es: "Mezcla de voces", en: "Vocal mix" }, description: { es: "", en: "" }, price: 1500, activo }],
});

test("el id del servicio es el del catálogo", () => {
  assert.equal(SERVICIO_MEZCLA_VOCES, "mezcla-voces");
});

test("el enlace lleva el servicio, el cliente y el proyecto de origen", () => {
  const url = urlAgregarServicio(SERVICIO_MEZCLA_VOCES, { id: "p-dea2", contacto_id: "c-juan" });
  assert.ok(url.startsWith("/admin/cotizaciones?"));
  const q = new URL(url, "https://x.test").searchParams;
  assert.equal(q.get("nueva"), "mezcla-voces");
  assert.equal(q.get("origen"), "p-dea2");
  assert.equal(q.get("cliente"), "c-juan");
});

test("un proyecto sin cliente ligado no manda el parámetro del cliente", () => {
  const url = urlAgregarServicio(SERVICIO_MEZCLA_VOCES, { id: "p-dea2", contacto_id: null });
  assert.equal(new URL(url, "https://x.test").searchParams.has("cliente"), false);
});

test("ida y vuelta: lo que arma el enlace lo entiende el cotizador", () => {
  const url = urlAgregarServicio(SERVICIO_MEZCLA_VOCES, { id: "p-dea2", contacto_id: "c-juan" });
  assert.deepEqual(precargaDeUrl(parametros(url), existe), { servicio: "mezcla-voces", contactoId: "c-juan", origenId: "p-dea2" });
});

test("sin ?nueva= no hay precarga", () => {
  assert.equal(precargaDeUrl(parametros("/admin/cotizaciones"), existe), null);
  assert.equal(precargaDeUrl(parametros("/admin/cotizaciones?vista=contratos"), existe), null);
});

test("un servicio que no se puede precargar se ignora (la URL la escribe cualquiera)", () => {
  assert.equal(precargaDeUrl(parametros("/admin/cotizaciones?nueva=lo-que-sea"), existe), null);
});

test("un cliente o proyecto que no existe se descarta, pero la cotización sí se abre", () => {
  const p = precargaDeUrl(parametros("/admin/cotizaciones?nueva=mezcla-voces&cliente=otro&origen=nada"), existe);
  assert.deepEqual(p, { servicio: "mezcla-voces", contactoId: null, origenId: null });
});

test("el concepto precargado sale del catálogo, con su precio de hoy", () => {
  const items = itemsDePrecarga(catalogo(), { servicio: "mezcla-voces", contactoId: null, origenId: null });
  assert.deepEqual(items, [{ label: "Mezcla de voces", qty: 1, unitPrice: 1500 }]);
});

test("si el servicio está oculto en el catálogo no se precarga", () => {
  assert.deepEqual(itemsDePrecarga(catalogo(false), { servicio: "mezcla-voces", contactoId: null, origenId: null }), []);
});

test("sin precarga no hay conceptos", () => {
  assert.deepEqual(itemsDePrecarga(catalogo(), null), []);
});
