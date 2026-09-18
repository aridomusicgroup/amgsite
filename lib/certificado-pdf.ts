import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { LOGO_ARIDO } from "@/lib/pdf/logo";
import { DOMAINS } from "@/lib/site";

/**
 * Certificado de un curso (de término o con mención). Horizontal, tamaño
 * carta, con folio y la URL pública donde cualquiera puede verificarlo.
 * Las fuentes estándar de PDF sólo aceptan Latin-1: se limpian acentos raros,
 * emojis y comillas tipográficas.
 */

export interface CertificadoData {
  id: string;
  nombre: string;
  curso: string;
  tipo: "termino" | "mencion";
  fecha: Date;
}

const limpiar = (s: string): string =>
  (s || "")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\xFF]/g, "")
    .trim();

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLarga = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

export async function generarCertificado(d: CertificadoData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(limpiar(`Certificado - ${d.curso}`));
  pdf.setAuthor("Árido Music Group");
  const W = 792;
  const H = 612;
  const page = pdf.addPage([W, H]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifB = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const rojo = rgb(0.77, 0.18, 0.26);
  const tinta = rgb(0.14, 0.11, 0.08);
  const gris = rgb(0.45, 0.42, 0.38);

  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.98, 0.97, 0.95) });
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: rojo, borderWidth: 2 });
  page.drawRectangle({ x: 32, y: 32, width: W - 64, height: H - 64, borderColor: rgb(0.8, 0.76, 0.7), borderWidth: 0.6 });

  const centro = (texto: string, y: number, font = serif, size = 14, color = tinta) => {
    const t = limpiar(texto);
    const w = font.widthOfTextAtSize(t, size);
    page.drawText(t, { x: (W - w) / 2, y, size, font, color });
  };

  try {
    const logo = await pdf.embedPng(Buffer.from(LOGO_ARIDO, "base64"));
    const ancho = 120;
    const alto = (logo.height / logo.width) * ancho;
    page.drawImage(logo, { x: (W - ancho) / 2, y: H - 70 - alto, width: ancho, height: alto });
  } catch {
    /* sin logo: el certificado sigue siendo válido */
  }

  centro("CERTIFICADO", 400, serifB, 34, tinta);
  centro(d.tipo === "mencion" ? "CON MENCIÓN" : "DE TÉRMINO", 374, sans, 11, rojo);
  centro("Se otorga a", 330, serif, 14, gris);

  // El nombre se achica si es muy largo, para que nunca se salga del marco.
  let size = 30;
  const nombre = limpiar(d.nombre) || "Alumno";
  while (size > 16 && serifB.widthOfTextAtSize(nombre, size) > W - 160) size -= 2;
  centro(nombre, 290, serifB, size, tinta);
  page.drawLine({ start: { x: W / 2 - 180, y: 280 }, end: { x: W / 2 + 180, y: 280 }, thickness: 0.8, color: rojo });

  centro(
    d.tipo === "mencion" ? "por completar y aprobar con revisión personal las evaluaciones del curso" : "por completar la ruta principal del curso",
    248, serif, 14, gris,
  );
  centro(d.curso, 218, serifB, 20, tinta);
  centro(fechaLarga(d.fecha), 180, serif, 12, gris);

  centro("Árido Music Group · Latino Gang Beats", 110, sans, 10, gris);
  centro(`Folio ${d.id.slice(0, 8).toUpperCase()} · Verifica en ${DOMAINS.main.replace("https://", "")}/certificado/${d.id}`, 92, sans, 8, gris);

  return pdf.save();
}
