// Copia a public/alphatab/ lo que alphaTab necesita en el navegador (script,
// fuente de notación y soundfont). Se sirve como archivo estático y se carga
// sólo en las lecciones de tablatura: así no pasa por el bundler (Turbopack no
// corre el plugin de webpack de alphaTab). Corre solo en `postinstall`.
// Licencias: alphaTab MPL-2.0, Bravura OFL, soundfont Sonivox (Apache) — se
// copian sus avisos junto a los archivos.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origen = join(raiz, "node_modules", "@coderline", "alphatab");
const destino = join(raiz, "public", "alphatab");

if (!existsSync(origen)) {
  console.log("[alphatab] paquete no instalado; nada que copiar.");
  process.exit(0);
}

const archivos = [
  ["dist/alphaTab.min.js", "alphaTab.min.js"],
  ["dist/alphaTab.worker.min.mjs", "alphaTab.worker.min.mjs"],
  ["dist/alphaTab.worklet.min.mjs", "alphaTab.worklet.min.mjs"],
  ["dist/font/Bravura.woff2", "font/Bravura.woff2"],
  ["dist/font/Bravura.woff", "font/Bravura.woff"],
  ["dist/font/Bravura-OFL.txt", "font/Bravura-OFL.txt"],
  ["dist/soundfont/sonivox.sf2", "soundfont/sonivox.sf2"],
  ["dist/soundfont/LICENSE", "soundfont/LICENSE"],
  ["LICENSE", "LICENSE-alphaTab.txt"],
];

for (const [de, a] of archivos) {
  const src = join(origen, de);
  if (!existsSync(src)) continue;
  const dst = join(destino, a);
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst);
}
console.log(`[alphatab] listo en ${destino}`);
