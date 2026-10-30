/**
 * Ayudas de la forma de onda del cuadro de render. Puras y sin `server-only`:
 * las usa el componente del navegador y las prueba `npm test`.
 */

/** Lo que guarda `render_ondas` para una versión del .rpp (ver supabase-render-ondas.sql). */
export interface OndaDatos {
  /** Segundos que cubre: del 0 al fin del último item. 0 = proyecto vacío. */
  duracion: number;
  /** Un byte por punto (0-255, escala de raíz), en base64. */
  picos: string;
  items: number;
  /** Items que no se pudieron leer (MP3, archivos que faltan…). */
  omitidos: number;
  /** mtime del .rpp con el que se calculó; si no es el del inventario, está vieja. */
  mtime: number;
}

export interface Rango {
  inicio: number;
  fin: number;
}

/** Los picos como bytes. Un base64 roto da una onda vacía: la onda es un adorno, no debe tronar el cuadro. */
export function decodificarPicos(b64: string): Uint8Array {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

/**
 * Menos puntos para dibujar: con 1,500 en un cuadro de ~460 px sobran. Se queda
 * con el MÁXIMO de cada grupo —no el promedio— para que un golpe no desaparezca.
 */
export function reducirPicos(picos: Uint8Array, destino: number): Uint8Array {
  if (destino <= 0 || picos.length <= destino) return picos;
  const out = new Uint8Array(destino);
  for (let i = 0; i < destino; i++) {
    const a = Math.floor((i * picos.length) / destino);
    const b = Math.max(a + 1, Math.floor(((i + 1) * picos.length) / destino));
    let max = 0;
    for (let k = a; k < b; k++) if (picos[k] > max) max = picos[k];
    out[i] = max;
  }
  return out;
}

/**
 * Dónde empieza y termina el sonido, con un poco de holgura. null si no hay.
 *
 * Un punto cuenta si él y al menos otro de sus dos vecinos pasan del umbral: un
 * clic aislado a los 0.3 s (un conteo, un golpe de micro) no debe confundirse con
 * el inicio del tema. El umbral (10 % de la escala de raíz ≈ −40 dB) deja pasar
 * una intro baja pero sostenida y se queda arriba del ruido de fondo.
 */
export function detectarSonido(picos: Uint8Array, duracion: number, umbral = 0.1): Rango | null {
  const n = picos.length;
  if (!n || !(duracion > 0)) return null;
  const limite = umbral * 255;
  const suena = (i: number) => (i >= 0 && i < n && picos[i] > limite ? 1 : 0);
  const firme = (i: number) => suena(i - 1) + suena(i) + suena(i + 1) >= 2 && suena(i) === 1;

  let primero = -1;
  let ultimo = -1;
  for (let i = 0; i < n; i++) {
    if (!firme(i)) continue;
    if (primero < 0) primero = i;
    ultimo = i;
  }
  if (primero < 0) return null;

  const punto = duracion / n;
  return {
    inicio: Math.max(0, primero * punto - 0.2),
    fin: Math.min(duracion, (ultimo + 1) * punto + 0.5),
  };
}

/** `3:10.6`. Se redondea a décimas ANTES de partir en minutos, para que 59.96 sea 1:00.0 y no 0:60.0. */
export function formatearTiempo(seg: number): string {
  const decimas = Math.round(Math.max(0, Number.isFinite(seg) ? seg : 0) * 10);
  const m = Math.floor(decimas / 600);
  const resto = decimas % 600;
  return `${m}:${String(Math.floor(resto / 10)).padStart(2, "0")}.${resto % 10}`;
}

/** Lo contrario: "1:23.4", "1:05", "83.4" o "83,4" → segundos. null si no es un tiempo. */
export function leerTiempo(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  let m = /^(\d+):(\d{1,2})(?:\.(\d+))?$/.exec(t);
  if (m) {
    const seg = Number(m[2]);
    if (seg >= 60) return null;
    return Number(m[1]) * 60 + seg + (m[3] ? Number(`0.${m[3]}`) : 0);
  }
  m = /^\d+(?:\.\d+)?$/.exec(t);
  return m ? Number(t) : null;
}

/** El render no acepta un tramo de menos de 1 s (lo valida el servidor y `fijarRango`). */
export const DURACION_MINIMA_S = 1;

/** Margen para el punto flotante: (inicio + 1) - inicio a veces da 0.9999999999999999. */
const EPSILON_S = 1e-6;

/** ¿Dura menos del mínimo? Con tolerancia: un tramo de "1 s" nunca debe verse como corto. */
export function rangoMuyCorto(r: Rango): boolean {
  return r.fin - r.inicio < DURACION_MINIMA_S - EPSILON_S;
}

/** Ordena, recorta al eje y exige la duración mínima (el render no acepta menos de 1 s). */
export function normalizarRango(r: Rango, tope: number, minimo = DURACION_MINIMA_S): Rango {
  const recortar = (v: number) => Math.max(0, Math.min(v, tope));
  const a = recortar(Math.min(r.inicio, r.fin));
  let b = recortar(Math.max(r.inicio, r.fin));
  if (b - a >= minimo - EPSILON_S) return { inicio: a, fin: b };
  if (a + minimo <= tope) return { inicio: a, fin: a + minimo };
  b = tope;
  return { inicio: Math.max(0, tope - minimo), fin: b };
}

/** Si `seg` cae a menos de `tolerancia` segundos de un marcador, el del marcador. */
export function pegarAMarcador(seg: number, marcadores: { seg: number }[], tolerancia: number): number {
  let mejor = seg;
  let dist = tolerancia;
  for (const m of marcadores) {
    const d = Math.abs(m.seg - seg);
    if (d <= dist) { mejor = m.seg; dist = d; }
  }
  return mejor;
}

const PASOS_REGLA = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

/** Cada cuántos segundos poner una marca en la regla para que no queden encimadas. */
export function pasoDeRegla(duracionEje: number, anchoPx: number, minPx = 64): number {
  for (const p of PASOS_REGLA) if ((p / duracionEje) * anchoPx >= minPx) return p;
  return PASOS_REGLA[PASOS_REGLA.length - 1];
}

/** Los marcadores cuya ETIQUETA cabe: los demás se dibujan como línea pero sin nombre. */
export function marcadoresVisibles<T extends { seg: number }>(marcadores: T[], ejeFin: number, anchoPx: number, minPx = 56): T[] {
  const out: T[] = [];
  let ultimo = -Infinity;
  for (const m of [...marcadores].sort((a, b) => a.seg - b.seg)) {
    const x = (m.seg / ejeFin) * anchoPx;
    if (x - ultimo >= minPx) { out.push(m); ultimo = x; }
  }
  return out;
}

/**
 * El contorno de la onda como un solo trazo SVG, espejado sobre el centro.
 * Ocupa de 0 a `ancho` en x; `alto` es el alto total.
 */
export function trazoOnda(picos: Uint8Array, ancho: number, alto: number): string {
  const n = picos.length;
  if (!n) return "";
  const medio = alto / 2;
  const x = (i: number) => (((i + 0.5) / n) * ancho).toFixed(1);
  const dy = (i: number) => ((picos[i] / 255) * (medio - 1)).toFixed(1);
  let d = `M0,${medio}`;
  for (let i = 0; i < n; i++) d += `L${x(i)},${(medio - Number(dy(i))).toFixed(1)}`;
  d += `L${ancho},${medio}`;
  for (let i = n - 1; i >= 0; i--) d += `L${x(i)},${(medio + Number(dy(i))).toFixed(1)}`;
  return `${d}Z`;
}

/**
 * ¿Es una consulta de onda que tiene sentido? La clave es el uuid de un proyecto
 * o de una canción, y el archivo el NOMBRE de un .rpp (sin carpetas): lo manda el
 * navegador y termina como filtro de una consulta, así que se revisa.
 */
export function consultaOndaValida(clave: string, archivo: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clave) &&
    archivo.length > 4 && archivo.length <= 260 &&
    !/[\/]/.test(archivo) && !archivo.includes("..") &&
    archivo.toLowerCase().endsWith(".rpp")
  );
}
