// Pruebas de la ficha de beat (capa encima del catálogo y precios por beat).
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aplicarFicha, preciosEfectivos, avisosDePrecios, validarFicha, validarPrecios,
  fichaVacia, describirCambioPrecios, exclusivaEsDirecta,
} from "./beat-ficha.ts";

const beat = {
  id: "TK1", title: "LAGRIMA$ JUNIOR H TYPE BEAT", bpm: 130, key: "D#m", genre: "Latin",
  artists: ["Junior H"], mood: "Energetic", tags: ["corrido"],
  artworkUrl: "https://cdn5.beatstars.com/chica", artworkLarge: "https://cdn5.beatstars.com/grande",
};

const GLOBALES = { basic: 25, premium: 50, "premium-plus": 100, exclusive: null };

test("sin ficha el beat queda igual y no se marca destacado", () => {
  const r = aplicarFicha(beat, null);
  assert.equal(r.bpm, 130);
  assert.equal(r.artworkUrl, beat.artworkUrl);
  assert.equal(r.destacado, false);
  assert.equal(r.descripcion, null);
});

test("una ficha vacía no pisa nada (null = lo de siempre)", () => {
  const r = aplicarFicha(beat, fichaVacia("TK1"));
  assert.deepEqual(
    { bpm: r.bpm, key: r.key, genre: r.genre, artists: r.artists, tags: r.tags, artworkLarge: r.artworkLarge },
    { bpm: 130, key: "D#m", genre: "Latin", artists: ["Junior H"], tags: ["corrido"], artworkLarge: beat.artworkLarge },
  );
});

test("la ficha gana campo por campo y no muta el beat original", () => {
  const ficha = { ...fichaVacia("TK1"), bpm: 140, tonalidad: "Em", artistas: ["Natanael Cano"], destacado: true, descripcion: "Oscuro" };
  const r = aplicarFicha(beat, ficha);
  assert.equal(r.bpm, 140);
  assert.equal(r.key, "Em");
  assert.deepEqual(r.artists, ["Natanael Cano"]);
  assert.equal(r.genre, "Latin");
  assert.equal(r.destacado, true);
  assert.equal(r.descripcion, "Oscuro");
  assert.equal(beat.bpm, 130);
  assert.deepEqual(beat.artists, ["Junior H"]);
});

test("la portada propia reemplaza las dos medidas; si sólo hay una, sirve para ambas", () => {
  const ambas = aplicarFicha(beat, { ...fichaVacia("TK1"), portada_url: "https://x/1200.webp", portada_chica_url: "https://x/400.webp" });
  assert.equal(ambas.artworkUrl, "https://x/400.webp");
  assert.equal(ambas.artworkLarge, "https://x/1200.webp");
  const una = aplicarFicha(beat, { ...fichaVacia("TK1"), portada_url: "https://x/1200.webp" });
  assert.equal(una.artworkUrl, "https://x/1200.webp");
  assert.equal(una.artworkLarge, "https://x/1200.webp");
});

test("precios: sin ajuste salen los globales y la exclusiva sigue la regla legacy", () => {
  const nuevo = preciosEfectivos({ globales: GLOBALES, ajuste: null, modo: null, esLegacy: false, exclusivaDirecta: 600 });
  assert.deepEqual(nuevo, { basic: 25, premium: 50, "premium-plus": 100, exclusive: 600 });
  const legacy = preciosEfectivos({ globales: GLOBALES, ajuste: null, modo: null, esLegacy: true, exclusivaDirecta: 600 });
  assert.equal(legacy.exclusive, null);
});

test("precios: el ajuste gana sólo en la licencia que lo trae", () => {
  const p = preciosEfectivos({ globales: GLOBALES, ajuste: { premium: 70 }, modo: null, esLegacy: false, exclusivaDirecta: 600 });
  assert.deepEqual(p, { basic: 25, premium: 70, "premium-plus": 100, exclusive: 600 });
});

test("precios: el modo de la exclusiva le gana a legacy-beats.json", () => {
  const abrir = preciosEfectivos({ globales: GLOBALES, ajuste: { exclusive: 900 }, modo: "directa", esLegacy: true, exclusivaDirecta: 600 });
  assert.equal(abrir.exclusive, 900);
  const cerrar = preciosEfectivos({ globales: GLOBALES, ajuste: { exclusive: 900 }, modo: "negociar", esLegacy: false, exclusivaDirecta: 600 });
  assert.equal(cerrar.exclusive, null);
  assert.equal(exclusivaEsDirecta(null, true), false);
  assert.equal(exclusivaEsDirecta(null, false), true);
});

test("avisos cuando la escalera de precios queda al revés", () => {
  assert.deepEqual(avisosDePrecios({ basic: 25, premium: 50, "premium-plus": 100, exclusive: 600 }), []);
  const avisos = avisosDePrecios({ basic: 25, premium: 120, "premium-plus": 100, exclusive: null });
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /Premium Plus/);
});

test("validarPrecios: vacío quita el ajuste, fuera de rango se rechaza, redondea a centavos", () => {
  assert.deepEqual(validarPrecios({ basic: "", premium: null }), { ok: true, valor: null });
  assert.equal(validarPrecios({ basic: 0 }).ok, false);
  assert.equal(validarPrecios({ premium: 20000 }).ok, false);
  assert.equal(validarPrecios({ gratis: 5 }).ok, false);
  assert.deepEqual(validarPrecios({ premium: "69.999" }), { ok: true, valor: { premium: 70 } });
});

test("validarFicha: sólo toca lo que viene y limpia listas", () => {
  const r = validarFicha({ bpm: "132", tags: "Corrido, corrido ,  Tumbado", artistas: ["Junior H", "", "Junior H"] });
  assert.equal(r.ok, true);
  assert.deepEqual(r.valor, { bpm: 132, tags: ["corrido", "tumbado"], artistas: ["Junior H"] });
  assert.equal("genero" in r.valor, false);
});

test("validarFicha: rechaza BPM y tonalidad imposibles, acepta vaciarlos", () => {
  assert.equal(validarFicha({ bpm: 999 }).ok, false);
  assert.equal(validarFicha({ tonalidad: "H#m" }).ok, false);
  assert.deepEqual(validarFicha({ bpm: "", tonalidad: "" }), { ok: true, valor: { bpm: null, tonalidad: null } });
  assert.equal(validarFicha({ tonalidad: "Ebm" }).ok, true);
});

test("validarFicha: oculto/destacado sólo con true explícito; nada que guardar es error", () => {
  assert.deepEqual(validarFicha({ oculto: "true" }).valor, { oculto: false });
  assert.deepEqual(validarFicha({ destacado: true }).valor, { destacado: true });
  assert.equal(validarFicha({ inventado: 1 }).ok, false);
  assert.equal(validarFicha({ exclusiva_modo: "gratis" }).ok, false);
});

test("describe los cambios de precio para la bitácora", () => {
  const antes = { basic: 25, premium: 50, "premium-plus": 100, exclusive: null };
  const despues = { basic: 25, premium: 70, "premium-plus": 100, exclusive: 800 };
  assert.deepEqual(describirCambioPrecios(antes, despues), ["Premium de $50 a $70", "Exclusiva de negociable a $800"]);
});

import { limpiarUrl, canalDeUrl, idYoutube } from "./beat-ficha.ts";

test("limpiarUrl acepta links sin https y rechaza basura", () => {
  assert.equal(limpiarUrl("youtu.be/dQw4w9WgXcQ"), "https://youtu.be/dQw4w9WgXcQ");
  assert.equal(limpiarUrl("javascript:alert(1)"), null);
  assert.equal(limpiarUrl("hola"), null);
  assert.equal(limpiarUrl(""), null);
});

test("canalDeUrl reconoce cada red por su dominio", () => {
  assert.equal(canalDeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "youtube");
  assert.equal(canalDeUrl("https://m.youtube.com/shorts/dQw4w9WgXcQ"), "youtube");
  assert.equal(canalDeUrl("https://www.instagram.com/reel/C8abc/"), "instagram");
  assert.equal(canalDeUrl("https://vm.tiktok.com/ZM123/"), "tiktok");
  assert.equal(canalDeUrl("https://fb.watch/abc/"), "facebook");
  assert.equal(canalDeUrl("https://notyoutube.com/x"), "otro");
});

test("idYoutube saca el id de watch, youtu.be, shorts y embed", () => {
  assert.equal(idYoutube("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), "dQw4w9WgXcQ");
  assert.equal(idYoutube("https://youtu.be/dQw4w9WgXcQ?si=x"), "dQw4w9WgXcQ");
  assert.equal(idYoutube("https://youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(idYoutube("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(idYoutube("https://www.youtube.com/@LatinoGangBeats"), null);
  assert.equal(idYoutube("https://www.instagram.com/reel/dQw4w9WgXcQ"), null);
});
