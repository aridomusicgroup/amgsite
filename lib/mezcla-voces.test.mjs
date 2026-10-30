// Pruebas de la lógica pura de "Mezcla de voces" sobre un tema ya entregado.
// Node 24 corre el .ts directo. Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  esMezclaDeVoces, herenciaReaper, comparteSesionDelOriginal, TIPO_PROYECTO_MEZCLA_VOCES, TIPO_VENTA_MEZCLA_VOCES,
} from "./mezcla-voces.ts";

// Misma regla que lib/carpeta-reaper.ts: la carpeta en disco va en mayúsculas y sin caracteres ilegales.
const nombreCarpeta = (s) => String(s ?? "").replace(/[\/:*?"<>|]/g, "").trim().toUpperCase();

test("los nombres del tipo no cambian (el SQL y el script dependen de ellos)", () => {
  assert.equal(TIPO_PROYECTO_MEZCLA_VOCES, "mezcla_voces");
  assert.equal(TIPO_VENTA_MEZCLA_VOCES, "Mezcla de voces");
});

test("reconoce el concepto del catálogo en español e inglés", () => {
  assert.equal(esMezclaDeVoces([{ label: "Mezcla de voces" }]), true);
  assert.equal(esMezclaDeVoces([{ label: "Vocal mix" }]), true);
});

test("aguanta mayúsculas, acentos y el nombre del tema pegado al concepto", () => {
  assert.equal(esMezclaDeVoces([{ label: "MEZCLA DE VOCES — DE A 2" }]), true);
  assert.equal(esMezclaDeVoces([{ label: "  mezcla de voz  " }]), true);
});

test("varias líneas de mezcla de voces (varios temas) siguen siendo mezcla de voces", () => {
  assert.equal(esMezclaDeVoces([{ label: "Mezcla de voces" }, { label: "Mezcla de voces — otro tema" }]), true);
});

test("si la cotización lleva otra cosa, ya no es solo mezcla de voces", () => {
  assert.equal(esMezclaDeVoces([{ label: "Mezcla de voces" }, { label: "Mezcla y master de canción completa" }]), false);
  assert.equal(esMezclaDeVoces([{ label: "Mezcla de voces" }, { label: "Requinto" }]), false);
});

test("no confunde mezcla y master, ni grabación de voces", () => {
  assert.equal(esMezclaDeVoces([{ label: "Mezcla y master de canción completa" }]), false);
  assert.equal(esMezclaDeVoces([{ label: "Grabación de voces" }]), false);
});

test("sin conceptos no hay nada que reconocer", () => {
  assert.equal(esMezclaDeVoces([]), false);
  assert.equal(esMezclaDeVoces([{ label: "" }]), false);
});

test("hereda la sesión de REAPER del proyecto original", () => {
  const origen = { tipo: "beat_personalizado", titulo: "De a 2", reaper_carpeta: null, contacto_id: "juan" };
  assert.deepEqual(herenciaReaper(origen, "juan", nombreCarpeta), { reaper_creado: true, reaper_carpeta: "DE A 2" });
});

test("si el original se renombró, manda la carpeta anclada y no el título de hoy", () => {
  const origen = { tipo: "grabacion", titulo: "De a 2 (versión final)", reaper_carpeta: "DE A 2", contacto_id: "juan" };
  assert.deepEqual(herenciaReaper(origen, "juan", nombreCarpeta), { reaper_creado: true, reaper_carpeta: "DE A 2" });
});

test("sin proyecto original no hereda nada: nace con su propia carpeta, como siempre", () => {
  assert.equal(herenciaReaper(null, "juan", nombreCarpeta), null);
});

test("si el original es de otro cliente, la carpeta del cliente no coincide: no hereda", () => {
  const origen = { tipo: "beat_personalizado", titulo: "De a 2", reaper_carpeta: null, contacto_id: "otro" };
  assert.equal(herenciaReaper(origen, "juan", nombreCarpeta), null);
  assert.equal(herenciaReaper(origen, null, nombreCarpeta), null);
});

test("en un EP o álbum el .rpp está dentro de cada tema: no hay una carpeta única que heredar", () => {
  for (const tipo of ["ep", "album"]) {
    const origen = { tipo, titulo: "TRiP MX", reaper_carpeta: null, contacto_id: "juan" };
    assert.equal(herenciaReaper(origen, "juan", nombreCarpeta), null);
  }
});

test("un título que se queda sin nombre de carpeta no hereda una carpeta vacía", () => {
  const origen = { tipo: "beat_personalizado", titulo: "???", reaper_carpeta: null, contacto_id: "juan" };
  assert.equal(herenciaReaper(origen, "juan", nombreCarpeta), null);
});

test("una mezcla de voces anclada a una carpeta trabaja en la sesión del original", () => {
  assert.equal(comparteSesionDelOriginal({ tipo: "mezcla_voces", reaper_carpeta: "DE A 2" }), true);
});

test("sin ancla no hay carpeta ajena: es una mezcla de voces con su propia carpeta", () => {
  assert.equal(comparteSesionDelOriginal({ tipo: "mezcla_voces", reaper_carpeta: null }), false);
  assert.equal(comparteSesionDelOriginal({ tipo: "mezcla_voces", reaper_carpeta: "" }), false);
});

test("cualquier otro tipo de proyecto, con o sin ancla, es dueño de su carpeta", () => {
  assert.equal(comparteSesionDelOriginal({ tipo: "beat_personalizado", reaper_carpeta: "ALFRED" }), false);
  assert.equal(comparteSesionDelOriginal({ tipo: null, reaper_carpeta: "ALFRED" }), false);
});
