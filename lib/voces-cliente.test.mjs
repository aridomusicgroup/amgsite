// Pruebas de la lógica pura de las voces que sube el cliente. Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { aceptaVoces, pideTema, esWav, estadoVoz, TIPOS_CON_VOCES } from "./voces-cliente.ts";

test("acepta voces en toda producción con mezcla, no en la grabación suelta", () => {
  for (const t of ["beat_personalizado", "bp_letra", "exclusividad", "mezcla_master", "mezcla_voces", "ep", "album"]) {
    assert.equal(aceptaVoces(t), true, t);
  }
  assert.equal(aceptaVoces("grabacion"), false);
  assert.equal(aceptaVoces("beat"), false);
  assert.equal(aceptaVoces("contenido"), false);
  assert.equal(aceptaVoces(null), false);
  assert.equal(aceptaVoces(undefined), false);
});

test("los tipos con voces son un subconjunto de los que suben archivos (almacenamiento.ts)", async () => {
  const { TIPOS_CON_SUBIDA } = await import("./almacenamiento.ts");
  for (const t of TIPOS_CON_VOCES) assert.ok(TIPOS_CON_SUBIDA.includes(t), t);
});

test("sólo EP y álbum piden el tema", () => {
  assert.equal(pideTema("ep"), true);
  assert.equal(pideTema("album"), true);
  assert.equal(pideTema("mezcla_voces"), false);
  assert.equal(pideTema(null), false);
});

test("sólo WAV, sin importar mayúsculas ni espacios", () => {
  assert.equal(esWav("Lead verso.wav"), true);
  assert.equal(esWav("COROS.WAV "), true);
  assert.equal(esWav("voz.mp3"), false);
  assert.equal(esWav("voz.wav.mp3"), false);
  assert.equal(esWav("voz.aiff"), false);
  assert.equal(esWav(""), false);
  assert.equal(esWav(null), false);
});

test("estado: recibida hasta que entra a la sesión", () => {
  assert.equal(estadoVoz({ importado_at: null }), "recibida");
  assert.equal(estadoVoz({ importado_at: "2026-11-03T20:00:00Z" }), "en_sesion");
});
