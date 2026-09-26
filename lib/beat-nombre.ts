// Cómo se llama un beat, según quién lo escribió.
//
// El mismo beat aparece con nombres distintos en cada lado:
//   · catálogo / BeatStars:  «"LAGRIMA$" JUNIOR H TYPE BEAT»
//   · ventas web (Stripe):   «LAGRIMA$ JUNIOR H TYPE BEAT» (sin comillas)
//   · ventas de BeatStars y WhatsApp: «LAGRIMA$» (el nombre corto)
// Las ventas no guardan el id del beat, así que la única forma de ligarlas es
// por nombre. Aquí vive esa regla, para que el panel y la reconciliación no
// terminen contando cosas distintas.
//
// Módulo PURO.

export const norm = (s: string | null | undefined): string => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

/** Sin acentos ni mayúsculas: "Lágrima" y "LAGRIMA" son lo mismo. */
const clave = (s: string | null | undefined): string =>
  norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * El nombre corto del beat. El título de BeatStars lo trae entre comillas:
 *   «"Champagne" Oscar Maydon x Junior H | corrido tumbado» → "champagne"
 * Sin comillas, lo que va antes de "type"/"prod".
 */
export const nombreBeat = (titulo: string): string => {
  const m = (titulo || "").match(/["“”']([^"“”']+)["“”']/);
  if (m) return norm(m[1]);
  return norm((titulo || "").split(/\b(type|prod)\b/i)[0]);
};

/**
 * ¿Esta venta es de este beat?
 *
 * Compara el nombre COMPLETO (no "contiene"): "SOLO" no debe llevarse las
 * ventas de "SOLO TU". Una venta web con varios beats los trae unidos por " | ".
 */
export function ventaEsDelBeat(beatNombreVenta: string | null | undefined, tituloCrudo: string, tituloLimpio: string): boolean {
  if (!beatNombreVenta) return false;
  const corto = clave(nombreBeat(tituloCrudo));
  const completo = clave(tituloLimpio);
  for (const pieza of beatNombreVenta.split(" | ")) {
    const p = clave(pieza);
    if (!p) continue;
    if (p === completo || (corto && (p === corto || clave(nombreBeat(pieza)) === corto))) return true;
  }
  return false;
}
