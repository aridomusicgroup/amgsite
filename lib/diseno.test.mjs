// Pruebas de la lógica pura de Diseño visual. Node 24 corre el .ts directo.
// Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import raw from "../data/diseno.json" with { type: "json" };
import {
  sinCosto, servicioDeLabel, incluyeDeDiseno, costoSugerido, llevaDiseno,
  ahorroPaquete, validarCosto, margen, tituloConTema,
} from "./diseno.ts";

const catalogo = raw.servicios;
const por = (id) => catalogo.find((s) => s.id === id);

test("el catálogo público no trae el costo del diseñador", () => {
  const publico = sinCosto(catalogo);
  assert.equal(publico.length, catalogo.length);
  for (const s of publico) assert.equal("costo" in s, false);
  assert.equal(JSON.stringify(publico).includes("costo"), false);
  // Y no toca el original.
  assert.equal(por("cover-art").costo, 300);
});

test("ids únicos y todo precio por encima del costo", () => {
  const ids = new Set(catalogo.map((s) => s.id));
  assert.equal(ids.size, catalogo.length);
  for (const s of catalogo) assert.ok(s.precio > s.costo, `${s.id}: precio ${s.precio} ≤ costo ${s.costo}`);
});

test("ninguna línea pierde con el descuento máximo de fidelidad y la comisión de Stripe", () => {
  for (const s of catalogo) {
    const cobrado = s.precio * 0.85;               // 15% = escalón más alto
    const stripe = cobrado * 0.036 + 3;           // tarjeta nacional aprox.
    assert.ok(cobrado - stripe - s.costo > 0, `${s.id} pierde dinero`);
  }
});

test("servicioDeLabel gana el nombre más largo, ignora acentos y aguanta sufijos", () => {
  assert.equal(servicioDeLabel("Portada + Canvas de Spotify", catalogo).id, "cover-canvas");
  assert.equal(servicioDeLabel("Canvas de Spotify", catalogo).id, "canvas");
  assert.equal(servicioDeLabel("portada (cover art) — Alto Nivel", catalogo).id, "cover-art");
  assert.equal(servicioDeLabel("Paquete Lanzamiento Basico", catalogo).id, "lanzamiento-basico");
  assert.equal(servicioDeLabel("Paquete Tumbes", catalogo), null);
  assert.equal(servicioDeLabel("", catalogo), null);
});

test("costoSugerido multiplica por cantidad y no cobra lo que no es diseño", () => {
  const items = [
    { label: "Paquete Lanzamiento Básico", qty: 1, unitPrice: 1050 },
    { label: "Contenido para redes (por pieza)", qty: 4, unitPrice: 150 },
    { label: "Paquete Tumbes", qty: 1, unitPrice: 6000 },
    { label: "Entrega urgente en 24 h", qty: 1, unitPrice: 250 },
  ];
  assert.equal(costoSugerido(items, catalogo), 700 + 400 + 150);
  assert.equal(costoSugerido([{ label: "Mezcla y master", qty: 1 }], catalogo), 0);
  assert.equal(costoSugerido([{ label: "Portada (Cover Art)", qty: 0 }], catalogo), 0);
});

test("llevaDiseno e incluyeDeDiseno", () => {
  assert.equal(llevaDiseno([{ label: "Paquete Alucines" }], catalogo), false);
  assert.equal(llevaDiseno([{ label: "Paquete Alucines" }, { label: "Lyric video" }], catalogo), true);
  assert.deepEqual(incluyeDeDiseno("Branding de artista", catalogo).slice(0, 2), ["Logo", "Paleta de colores"]);
  assert.deepEqual(incluyeDeDiseno("Algo libre", catalogo), []);
});

test("ahorro de los paquetes contra precios sueltos", () => {
  assert.deepEqual(ahorroPaquete(por("lanzamiento-basico"), catalogo), { separado: 1550, ahorro: 500 });
  assert.deepEqual(ahorroPaquete(por("lanzamiento-premium"), catalogo), { separado: 3050, ahorro: 800 });
  assert.deepEqual(ahorroPaquete(por("identidad-completa"), catalogo), { separado: 2700, ahorro: 450 });
  assert.deepEqual(ahorroPaquete(por("cover-canvas"), catalogo), { separado: 800, ahorro: 100 });
  assert.equal(ahorroPaquete(por("logo"), catalogo), null);
  assert.equal(ahorroPaquete({ ...por("lanzamiento-basico"), componentes: [{ id: "no-existe" }] }, catalogo), null);
});

test("validarCosto rechaza negativos, basura y costos mayores al total", () => {
  assert.equal(validarCosto(700, 1050), null);
  assert.equal(validarCosto(0, 1050), null);
  assert.equal(validarCosto(1050.4, 1050), null);   // redondeo tolerado
  assert.match(validarCosto(-1, 1050), /de 0 en adelante/);
  assert.match(validarCosto("abc", 1050), /de 0 en adelante/);
  assert.match(validarCosto(1200, 1050), /más que el total/);
});

test("margen en pesos y porcentaje", () => {
  assert.deepEqual(margen(1050, 700), { monto: 350, pct: 33 });
  assert.deepEqual(margen(0, 0), { monto: 0, pct: 0 });
  assert.deepEqual(margen(892.5, 700), { monto: 192.5, pct: 22 });
});

test("tituloConTema agrega el tema una sola vez", () => {
  assert.equal(tituloConTema("Paquete Lanzamiento Básico", "Alto Nivel"), "Paquete Lanzamiento Básico — Alto Nivel");
  assert.equal(tituloConTema("Portada — Alto Nivel", "alto nivel"), "Portada — Alto Nivel");
  assert.equal(tituloConTema("Lyric video", null), "Lyric video");
  assert.equal(tituloConTema("Lyric video", "  "), "Lyric video");
});
