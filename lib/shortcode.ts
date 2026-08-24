// Extrae el shortcode de una URL de Instagram para ligar posts a contenido interno.
// Aguanta /reel/CODE/, /reels/CODE/, /p/CODE/, /tv/CODE/, con o sin query params o prefijo de perfil.
export function extraerShortcode(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}
