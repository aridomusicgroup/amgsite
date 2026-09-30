/**
 * Cómo tiene que exportar el músico lo que manda. UN solo lugar, porque lo leen
 * el portal (/musico, junto a cada botón) y el correo del previo: si cada uno
 * trajera su copia, el día que el estudio cambie de formato uno de los dos
 * seguiría pidiendo el viejo.
 *
 * Decisión del dueño (2026-09-29): la pista en WAV 32 bits float a 48 kHz, y el
 * previo en MP3 128 kbps a 44.1 kHz — el mismo formato que el previo que el
 * estudio le manda a él (medido en los renders: MP3 128 kbps / 44.1 kHz).
 */

export const FORMATO_PISTA = {
  corto: "WAV · 32 bits float · 48 kHz",
  pasos: [
    "Exporta desde el INICIO de la pista de referencia (0:00), aunque tu parte empiece después: así cae sola en su lugar.",
    "Hasta el final de la canción, con la misma duración que la referencia.",
    "Sólo tu instrumento: sin la referencia, sin efectos y sin normalizar.",
    "Una pista por archivo. Si grabaste varias (primera, segunda, adornos), mándalas cada una en su botón.",
  ],
} as const;

export const FORMATO_PREVIO = {
  corto: "MP3 · 128 kbps · 44.1 kHz",
  pasos: [
    "La canción completa con tu parte encima de la referencia, para escucharla como va a quedar.",
    "Es para escuchar, no para mezclar: tu pista de verdad va aparte, en WAV.",
  ],
} as const;
