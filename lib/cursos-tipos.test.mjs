// Pruebas de la lógica pura de Cursos. Node 24 corre el .ts directo (quita los
// tipos al cargarlo). Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMarcadores, formatoTiempo, aSegundos, calcularRacha, minutosSemana,
  extenderVencimiento, accesoVigente, puntajeQuiz, validarQuiz, recomendacionDiagnostico,
  esRellenar, camposVisibles, sanitizarContenido, validarRecursos, validarCalificacion,
  esFormatoEntrega, leerConfig, cuentaParaAvance,
} from "./cursos-tipos.ts";

test("parseMarcadores lee capítulos, ignora basura y ordena", () => {
  const r = parseMarcadores("1:05 - Variante con apagado\nbasura\n0:00 Intro\n1:02:03 Final\n0:99 malo");
  assert.deepEqual(r, [
    { t: 0, label: "Intro" },
    { t: 65, label: "Variante con apagado" },
    { t: 3723, label: "Final" },
  ]);
});

test("formatoTiempo y aSegundos son inversos", () => {
  assert.equal(formatoTiempo(65), "1:05");
  assert.equal(formatoTiempo(3723), "1:02:03");
  assert.equal(aSegundos("1:05"), 65);
  assert.equal(aSegundos("abc"), null);
});

test("calcularRacha no se rompe si hoy todavía no practica", () => {
  const fechas = ["2026-09-14", "2026-09-15", "2026-09-16"];
  assert.equal(calcularRacha(fechas, "2026-09-16"), 3);
  assert.equal(calcularRacha(fechas, "2026-09-17"), 3);
  assert.equal(calcularRacha(fechas, "2026-09-18"), 0);
  assert.equal(calcularRacha([], "2026-09-18"), 0);
});

test("minutosSemana suma sólo los últimos 7 días", () => {
  const regs = [
    { fecha: "2026-09-17", minutos: 30 },
    { fecha: "2026-09-11", minutos: 20 },
    { fecha: "2026-09-10", minutos: 99 },
  ];
  assert.equal(minutosSemana(regs, "2026-09-17"), 50);
});

test("extenderVencimiento cuenta desde lo más tarde y respeta fin de mes", () => {
  const ahora = new Date("2026-01-31T12:00:00Z");
  assert.equal(extenderVencimiento(null, ahora).slice(0, 10), "2026-02-28");
  assert.equal(extenderVencimiento("2026-03-15T00:00:00Z", ahora).slice(0, 10), "2026-04-15");
  assert.equal(extenderVencimiento("2025-12-01T00:00:00Z", ahora).slice(0, 10), "2026-02-28");
});

test("accesoVigente", () => {
  const ahora = new Date("2026-09-17T00:00:00Z");
  assert.equal(accesoVigente(null, ahora), true);
  assert.equal(accesoVigente("2026-09-18T00:00:00Z", ahora), true);
  assert.equal(accesoVigente("2026-09-16T00:00:00Z", ahora), false);
});

test("quiz: valida, califica y recomienda", () => {
  const preguntas = validarQuiz([
    { pregunta: "¿I-IV-V en G?", opciones: ["G C D", "G A B"], correcta: 0 },
    { pregunta: "mala", opciones: ["sólo una"], correcta: 0 },
    { pregunta: "¿Relativo menor de C?", opciones: ["Am", "Em", "Dm"], correcta: 0, audio: 2 },
  ]);
  assert.equal(preguntas.length, 2);
  assert.equal(preguntas[1].audio, 2);
  assert.deepEqual(puntajeQuiz(preguntas, [0, 1]), { correctas: 1, total: 2, pct: 50, aprobado: false });
  assert.equal(puntajeQuiz(preguntas, [0, 0]).aprobado, true);
  const rangos = [{ min: 0, texto: "Desde cero" }, { min: 60, texto: "Salta a M3" }];
  assert.equal(recomendacionDiagnostico(rangos, 75), "Salta a M3");
  assert.equal(recomendacionDiagnostico(rangos, 10), "Desde cero");
});

test("guion: [RELLENAR] y campos internos no llegan al alumno", () => {
  assert.equal(esRellenar("[RELLENAR: algo]"), true);
  assert.equal(esRellenar("  "), true);
  assert.equal(esRellenar("Listo"), false);
  const vis = camposVisibles({ dato: "La 12 carga ~100 kg", explicacion: "[RELLENAR]", fuente: "libro" }, "capsula");
  assert.deepEqual(vis, [{ label: "Dato", texto: "La 12 carga ~100 kg" }]);
});

test("sanitizarContenido tira claves desconocidas y valida estructuras", () => {
  const c = sanitizarContenido({ objetivo: "x", hack: "<script>", preguntas: [{ pregunta: "p", opciones: ["a"], correcta: 0 }], duracion_min: 9999 });
  assert.deepEqual(c, { objetivo: "x", preguntas: [] });
});

test("recursos y calificación", () => {
  assert.equal(validarRecursos([{ titulo: "Mapa", drive_file_id: "1AbCdEfGhIjKlMn" }, { titulo: "x", drive_file_id: "../../" }]).length, 1);
  const rub = [{ criterio: "Tempo", niveles: [] }];
  assert.deepEqual(validarCalificacion({ Tempo: 3, Otro: 2, X: 9 }, rub), { Tempo: 3 });
});

test("entregas, config y avance", () => {
  assert.equal(esFormatoEntrega("mi-video.MOV"), true);
  assert.equal(esFormatoEntrega("virus.exe"), false);
  const cfg = leerConfig({ mentoria: { estado: "lista_espera", precio_mes: "499" } });
  assert.equal(cfg.mentoria.estado, "lista_espera");
  assert.equal(cfg.mentoria.precio_mes, 499);
  assert.equal(leerConfig(null).mentoria.estado, "oculta");
  assert.equal(cuentaParaAvance({ etiqueta: "filosofia", opcional: false }), true);
  assert.equal(cuentaParaAvance({ etiqueta: "capsula", opcional: false }), false);
});

test("página de venta: FAQs y renglones ignoran la plantilla", async () => {
  const { parseFaqs, renglones, leerConfig } = await import("./cursos-tipos.ts");
  const faqs = parseFaqs("P: ¿Necesito partitura?\nR: No.\n\nP: [RELLENAR: otra]\nR: [RELLENAR]\n\nbasura");
  assert.deepEqual(faqs, [{ p: "¿Necesito partitura?", r: "No." }]);
  assert.deepEqual(renglones("- Uno\n\n[RELLENAR: dos]\n• Tres"), ["Uno", "Tres"]);
  assert.equal(leerConfig({ landing: { promesa: "x".repeat(900) } }).landing.promesa.length, 600);
});
