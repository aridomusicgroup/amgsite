// Pruebas de las ayudas de la forma de onda del cuadro de render.
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodificarPicos, reducirPicos, detectarSonido, formatearTiempo, leerTiempo,
  normalizarRango, pegarAMarcador, pasoDeRegla, marcadoresVisibles,
} from "./onda-rango.ts";

const aB64 = (arr) => Buffer.from(Uint8Array.from(arr)).toString("base64");

test("decodificarPicos: devuelve un byte por punto", () => {
  assert.deepEqual([...decodificarPicos(aB64([0, 1, 128, 255]))], [0, 1, 128, 255]);
  assert.equal(decodificarPicos("").length, 0);
});

test("decodificarPicos: un base64 roto da una onda vacía en vez de tronar", () => {
  assert.equal(decodificarPicos("%%%no es base64%%%").length, 0);
});

test("reducirPicos: se queda con el máximo de cada grupo (un golpe no se pierde)", () => {
  const r = reducirPicos(Uint8Array.from([1, 9, 2, 3, 4, 8, 5, 6]), 4);
  assert.deepEqual([...r], [9, 3, 8, 6]);
});

test("reducirPicos: si ya cabe, no toca nada", () => {
  const p = Uint8Array.from([1, 2, 3]);
  assert.deepEqual([...reducirPicos(p, 10)], [1, 2, 3]);
});

test("detectarSonido: encuentra dónde empieza y termina (con un poco de holgura)", () => {
  // 100 puntos en 10 s (0.1 s cada uno): sonido entre el punto 20 (2 s) y el 79 (8 s).
  const p = new Uint8Array(100);
  for (let i = 20; i < 80; i++) p[i] = 200;
  const r = detectarSonido(p, 10);
  assert.ok(r.inicio <= 2 && r.inicio >= 1.5, `inicio ${r.inicio}`);
  assert.ok(r.fin >= 8 && r.fin <= 9, `fin ${r.fin}`);
});

test("detectarSonido: un golpe suelto lejos del tema no cuenta como el inicio", () => {
  const p = new Uint8Array(200);          // 20 s
  p[3] = 255;                             // un clic aislado a los 0.3 s
  for (let i = 100; i < 180; i++) p[i] = 180;
  const r = detectarSonido(p, 20);
  assert.ok(r.inicio > 8, `inicio ${r.inicio}`);
});

test("detectarSonido: una intro baja pero sostenida SÍ cuenta", () => {
  const p = new Uint8Array(100);
  for (let i = 10; i < 30; i++) p[i] = 40;    // intro bajita
  for (let i = 30; i < 90; i++) p[i] = 220;
  assert.ok(detectarSonido(p, 10).inicio <= 1.1);
});

test("detectarSonido: puro silencio o sin datos devuelve null", () => {
  assert.equal(detectarSonido(new Uint8Array(100), 10), null);
  assert.equal(detectarSonido(new Uint8Array(0), 10), null);
  assert.equal(detectarSonido(Uint8Array.from([200, 200]), 0), null);
});

test("formatearTiempo: minutos:segundos con un decimal, sin saltos de redondeo", () => {
  assert.equal(formatearTiempo(0), "0:00.0");
  assert.equal(formatearTiempo(7.25), "0:07.3");
  assert.equal(formatearTiempo(190.61), "3:10.6");
  assert.equal(formatearTiempo(59.96), "1:00.0");
  assert.equal(formatearTiempo(-3), "0:00.0");
});

test("leerTiempo: entiende m:ss, m:ss.d, segundos sueltos y coma decimal", () => {
  assert.equal(leerTiempo("1:23.4"), 83.4);
  assert.equal(leerTiempo("1:05"), 65);
  assert.equal(leerTiempo("83.4"), 83.4);
  assert.equal(leerTiempo("83,4"), 83.4);
  assert.equal(leerTiempo(" 0:07 "), 7);
});

test("leerTiempo: lo que no es un tiempo da null", () => {
  for (const malo of ["", "abc", "1:2:3:4", "-5", "1:75", "0:-3"]) assert.equal(leerTiempo(malo), null, malo);
});

test("formatearTiempo y leerTiempo se ida y vuelta", () => {
  for (const s of [0, 3.1, 59.9, 60, 190.6, 599.9]) assert.equal(leerTiempo(formatearTiempo(s)), s);
});

test("normalizarRango: ordena, recorta al eje y exige el mínimo", () => {
  assert.deepEqual(normalizarRango({ inicio: 10, fin: 4 }, 100), { inicio: 4, fin: 10 });
  assert.deepEqual(normalizarRango({ inicio: -5, fin: 500 }, 100), { inicio: 0, fin: 100 });
  assert.deepEqual(normalizarRango({ inicio: 10, fin: 10.2 }, 100), { inicio: 10, fin: 11 });
  // Pegado al final del eje: el mínimo se consigue moviendo el inicio.
  assert.deepEqual(normalizarRango({ inicio: 99.8, fin: 100 }, 100), { inicio: 99, fin: 100 });
});

test("pegarAMarcador: se pega al marcador cercano y suelta al lejano", () => {
  const m = [{ seg: 10 }, { seg: 50 }];
  assert.equal(pegarAMarcador(10.3, m, 0.5), 10);
  assert.equal(pegarAMarcador(49.6, m, 0.5), 50);
  assert.equal(pegarAMarcador(30, m, 0.5), 30);
  assert.equal(pegarAMarcador(5, [], 0.5), 5);
});

test("pasoDeRegla: más separación a medida que el tema es más largo", () => {
  const corto = pasoDeRegla(30, 460);
  const largo = pasoDeRegla(600, 460);
  assert.ok(corto < largo);
  assert.ok((corto / 30) * 460 >= 64, "las marcas nunca quedan encimadas");
  assert.ok((largo / 600) * 460 >= 64);
});

test("marcadoresVisibles: quita las etiquetas que se encimarían, sin perder el primero", () => {
  const ms = [{ seg: 0, nombre: "INTRO" }, { seg: 1, nombre: "A" }, { seg: 60, nombre: "CORO" }, { seg: 61, nombre: "B" }];
  const v = marcadoresVisibles(ms, 100, 400, 40);
  assert.deepEqual(v.map((m) => m.nombre), ["INTRO", "CORO"]);
});

test("trazoOnda: dibuja un contorno cerrado y espejado, y nada si no hay datos", async () => {
  const { trazoOnda } = await import("./onda-rango.ts");
  assert.equal(trazoOnda(new Uint8Array(0), 1000, 100), "");
  const d = trazoOnda(Uint8Array.from([255, 0]), 1000, 100);
  assert.ok(d.startsWith("M0,50") && d.endsWith("Z"));
  assert.ok(d.includes("L250.0,1.0"), "el punto más alto llega casi hasta arriba");
  assert.ok(d.includes("L250.0,99.0"), "y su espejo casi hasta abajo");
});

test("consultaOndaValida: sólo una clave de proyecto y el nombre suelto de un .rpp", async () => {
  const { consultaOndaValida } = await import("./onda-rango.ts");
  const clave = "3c8068a7-6fa0-4a74-9f2d-1446644f31be";
  assert.equal(consultaOndaValida(clave, "MELODY QA.rpp"), true);
  assert.equal(consultaOndaValida("no-es-uuid", "A.rpp"), false);
  assert.equal(consultaOndaValida(clave, "../A.rpp"), false);
  assert.equal(consultaOndaValida(clave, "carpeta/A.rpp"), false);
  assert.equal(consultaOndaValida(clave, "A.txt"), false);
  assert.equal(consultaOndaValida(clave, ""), false);
  assert.equal(consultaOndaValida(clave, "x".repeat(300) + ".rpp"), false);
});

test("rangoMuyCorto: el mínimo de 1 s que fabrica normalizarRango nunca se ve como demasiado corto", async () => {
  const { rangoMuyCorto } = await import("./onda-rango.ts");
  let malos = 0;
  for (let c = 0; c <= 60000; c++) {
    const inicio = c / 100;
    const r = normalizarRango({ inicio, fin: inicio }, 1_000_000);
    if (rangoMuyCorto(r)) malos++;
  }
  assert.equal(malos, 0);
  assert.equal(rangoMuyCorto({ inicio: 5, fin: 5.9 }), true);
  assert.equal(rangoMuyCorto({ inicio: 5, fin: 6 }), false);
});
