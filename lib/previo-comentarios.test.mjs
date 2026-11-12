// Pruebas de los comentarios del cliente sobre un previo.
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resumirPedido, tituloDeTarea, limpiarComentario, limpiarSegundo, formatoMinuto, MAX_COMENTARIO,
} from "./previo-comentarios.ts";

test("el resumen es la primera idea, sin saludo y sin punto final", () => {
  assert.equal(
    resumirPedido("Hola, quiero que la voz suene más arriba en el coro. Y el bajo está muy fuerte."),
    "Quiero que la voz suene más arriba en el coro",
  );
  assert.equal(resumirPedido("Oye! sube el bajo"), "Sube el bajo");
});

test("un pedido largo se corta en una palabra completa y avisa con puntos", () => {
  const largo = "necesito que la guitarra del segundo verso se escuche bastante más fuerte que la voz principal porque no se oye";
  const r = resumirPedido(largo);
  assert.ok(r.length <= 71, `largo ${r.length}`);
  assert.ok(r.endsWith("…"));
  assert.ok(!/\s…$/.test(r));
  assert.ok(largo.startsWith(r.slice(0, -1).toLowerCase()) || largo.includes(r.slice(1, -1)));
});

test("sin nada utilizable, el resumen cae a un texto genérico", () => {
  assert.equal(resumirPedido("   "), "Comentario del cliente");
  assert.equal(resumirPedido("Hola!"), "Comentario del cliente");
});

test("el título de la tarea dice de qué previo es y, en un EP, de qué tema", () => {
  assert.equal(tituloDeTarea({ texto: "sube el bajo", previoNum: 2, tema: null }), "Previo 2 · Sube el bajo");
  assert.equal(tituloDeTarea({ texto: "sube el bajo", previoNum: null, tema: null }), "Previo · Sube el bajo");
  assert.equal(tituloDeTarea({ texto: "sube el bajo", previoNum: 1, tema: "LA KHABALAH" }), "LA KHABALAH · Previo · Sube el bajo");
});

test("limpiar el comentario: recorta, junta espacios y exige contenido", () => {
  assert.deepEqual(limpiarComentario("  sube   el\n\n\n\nbajo  "), { ok: true, texto: "sube el\n\nbajo" });
  assert.equal(limpiarComentario("   ").ok, false);
  assert.equal(limpiarComentario(undefined).ok, false);
  assert.equal(limpiarComentario(42).ok, false);
});

test("un comentario demasiado largo se rechaza, no se corta en silencio", () => {
  const r = limpiarComentario("a".repeat(MAX_COMENTARIO + 1));
  assert.equal(r.ok, false);
  assert.match(r.error, /largo/i);
  assert.equal(limpiarComentario("a".repeat(MAX_COMENTARIO)).ok, true);
});

test("el minuto marcado es un entero razonable o nada", () => {
  assert.equal(limpiarSegundo(83.7), 83);
  assert.equal(limpiarSegundo("12"), 12);
  assert.equal(limpiarSegundo(-3), null);
  assert.equal(limpiarSegundo(99999), null);
  assert.equal(limpiarSegundo(null), null);
  assert.equal(limpiarSegundo("abc"), null);
});

test("el minuto se escribe como en el reproductor", () => {
  assert.equal(formatoMinuto(0), "0:00");
  assert.equal(formatoMinuto(83), "1:23");
  assert.equal(formatoMinuto(605), "10:05");
});
