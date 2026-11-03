// Pruebas de las reglas de subida a Drive (sesiones abiertas por el servidor). Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nombreDeSubida,
  mimeDeSubida,
  bytesDeSubida,
  cabeEnEspacio,
  etiquetaDeCanal,
  MAX_NOMBRE_SUBIDA,
  MAX_BYTES_SUBIDA,
} from "./subida-validar.ts";

test("el nombre pierde la ruta y los caracteres de control, pero no los acentos", () => {
  assert.equal(nombreDeSubida("C:\\Users\\yo\\Voz Lead (versión 2).wav"), "Voz Lead (versión 2).wav");
  assert.equal(nombreDeSubida("../../otra/carpeta/coro.wav"), "coro.wav");
  assert.equal(nombreDeSubida("  lead\u0000\n.wav "), "lead.wav");
  assert.equal(nombreDeSubida(undefined), "");
  assert.equal(nombreDeSubida("a".repeat(500)).length, MAX_NOMBRE_SUBIDA);
});

test("el tipo es el del navegador si tiene forma de MIME, si no el de la extensión", () => {
  assert.equal(mimeDeSubida("audio/x-wav", "lead.wav"), "audio/x-wav");
  assert.equal(mimeDeSubida("", "lead.WAV"), "audio/wav");
  assert.equal(mimeDeSubida("", "previo.mp3"), "audio/mpeg");
  assert.equal(mimeDeSubida("text/html\r\nx-evil: 1", "lead.wav"), "audio/wav");
  assert.equal(mimeDeSubida(null, "sin-extension"), "application/octet-stream");
});

test("el tamaño tiene que ser positivo y bajo el tope", () => {
  assert.equal(bytesDeSubida(1234.9), 1234);
  assert.equal(bytesDeSubida("2048"), 2048);
  assert.equal(bytesDeSubida(0), null);
  assert.equal(bytesDeSubida(-5), null);
  assert.equal(bytesDeSubida("abc"), null);
  assert.equal(bytesDeSubida(MAX_BYTES_SUBIDA + 1), null);
  assert.equal(bytesDeSubida(11, 10), null);
});

test("el espacio: sin límite siempre cabe; con límite, lo usado más lo nuevo", () => {
  assert.equal(cabeEnEspacio(999, 0, 10), true);
  assert.equal(cabeEnEspacio(90, 100, 10), true);
  assert.equal(cabeEnEspacio(91, 100, 10), false);
});

test("la etiqueta del canal no mete caracteres que rompan el nombre", () => {
  assert.equal(etiquetaDeCanal("L"), "L");
  assert.equal(etiquetaDeCanal("Pista 2"), "Pista 2");
  assert.equal(etiquetaDeCanal('a/b\\c:*?"<>|'), "abc");
  assert.equal(etiquetaDeCanal(null), "");
  assert.equal(etiquetaDeCanal("x".repeat(80)).length, 30);
});
