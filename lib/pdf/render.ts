import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";

/**
 * Renderer de documentos PDF por "bloques" (pdf-lib), estilo "Modernist":
 * acento rojo #ec3013, texto casi negro #201e1d, etiquetas en mayúsculas,
 * cuadrículas, tablas con divisores, firmas en fila y barra de pie. Compartido
 * por cotizaciones y contratos. Fuente Helvetica (pdf-lib estándar).
 */

export interface SigEntry {
  name: string;
  role: string;
  sig?: "luis" | "eliud";
}

export interface Block {
  text?: string;
  bold?: boolean;
  size?: number;
  spaceBefore?: number;
  align?: "center" | "left";
  indent?: number;
  muted?: boolean;
  /** Texto en color de acento (rojo). */
  accent?: boolean;
  /** Fila de dos columnas (concepto ··· importe). `th` = encabezado de tabla. */
  row?: { left: string; right: string; bold?: boolean; indent?: number; muted?: boolean; th?: boolean };
  /** Línea horizontal separadora. */
  rule?: boolean;
  /** Etiqueta de sección: roja, mayúsculas, pequeña (ej. "CLIENTE", "DETALLE"). */
  sectionLabel?: string;
  /** Cuadrícula de datos nombre/valor en `cols` columnas (default 2). */
  grid?: { pairs: { name: string; value: string }[]; cols?: number };
  /** Bloque de firmas — se dibujan en FILA (una columna por firmante). */
  signature?: SigEntry[];
}

export interface RenderOpts {
  /** Pie de página simple (una línea centrada con folio). */
  footer?: string;
  /** Barra de pie: marca a la izquierda, folio a la derecha, con borde superior. */
  footerBar?: { left: string; right: string };
  /** Firmas en base64 (PNG) para incrustar en los bloques `signature`. */
  signatures?: { luis?: string; eliud?: string };
  /** Encabezado: logo a la izquierda + (opcional) etiqueta/título a la derecha. */
  header?: { logo?: string; logoWidth?: number; rightLabel?: string; rightTitle?: string };
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function fechaLarga(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} del año ${d.getFullYear()}`;
}

export function sanitize(s: string): string {
  return (s || "")
    .replace(/[""„‟]/g, '"')
    .replace(/[''‚‛]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

const PW = 612, PH = 792;
const MARGIN = 54, BOTTOM = 60;

// Paleta Modernist
const INK = rgb(0.125, 0.118, 0.114);      // #201e1d
const NEUTRAL = rgb(0.376, 0.365, 0.365);  // #605d5d
const ACCENT = rgb(0.925, 0.188, 0.075);   // #ec3013
const ACCENT7 = rgb(0.682, 0.094, 0.0);    // #ae1800
const DIVIDER = rgb(0.72, 0.71, 0.71);

export async function renderDocument(blocks: Block[], opts: RenderOpts = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const sigLuis = opts.signatures?.luis ? await pdf.embedPng(Buffer.from(opts.signatures.luis, "base64")) : null;
  const sigEliud = opts.signatures?.eliud ? await pdf.embedPng(Buffer.from(opts.signatures.eliud, "base64")) : null;

  const maxW = PW - MARGIN * 2;

  let page: PDFPage = pdf.addPage([PW, PH]);
  let y = PH - MARGIN;

  const wrapLines = (text: string, f: PDFFont, size: number, width: number): string[] => {
    const words = sanitize(text).split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (f.widthOfTextAtSize(test, size) > width && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  const clip = (text: string, f: PDFFont, size: number, width: number): string => {
    const t = sanitize(text);
    if (f.widthOfTextAtSize(t, size) <= width) return t;
    let s = t;
    while (s.length > 1 && f.widthOfTextAtSize(s + "...", size) > width) s = s.slice(0, -1);
    return s + "...";
  };
  const ensure = (h: number) => { if (y - h < BOTTOM) { page = pdf.addPage([PW, PH]); y = PH - MARGIN; } };
  const hr = (yy: number, thick = 2) =>
    page.drawLine({ start: { x: MARGIN, y: yy }, end: { x: PW - MARGIN, y: yy }, thickness: thick, color: DIVIDER });

  // ── Encabezado con logo (solo página 1) ──
  if (opts.header) {
    const h = opts.header;
    let logoBottom = y;
    if (h.logo) {
      try {
        const img = await pdf.embedPng(Buffer.from(h.logo, "base64"));
        const w = h.logoWidth ?? 72;
        const ih = (img.height / img.width) * w;
        page.drawImage(img, { x: MARGIN, y: y - ih, width: w, height: ih });
        logoBottom = y - ih;
      } catch { /* sin logo */ }
    }
    if (h.rightLabel) {
      const s = 10;
      const t = h.rightLabel.toUpperCase();
      const tw = bold.widthOfTextAtSize(t, s);
      page.drawText(t, { x: PW - MARGIN - tw, y: y - s - 2, size: s, font: bold, color: ACCENT7 });
    }
    if (h.rightTitle) {
      const s = 20;
      const tw = bold.widthOfTextAtSize(h.rightTitle, s);
      page.drawText(h.rightTitle, { x: PW - MARGIN - tw, y: y - s - 16, size: s, font: bold, color: INK });
    }
    y = logoBottom - 16;
    hr(y);
    y -= 16;
  }

  for (const b of blocks) {
    y -= b.spaceBefore ?? 10;

    // ── Etiqueta de sección ──
    if (b.sectionLabel) {
      ensure(20);
      page.drawText(b.sectionLabel.toUpperCase(), { x: MARGIN, y, size: 10.5, font: bold, color: ACCENT7 });
      y -= 16;
      continue;
    }

    // ── Cuadrícula nombre/valor ──
    if (b.grid) {
      const cols = b.grid.cols ?? 2;
      const colW = maxW / cols;
      let i = 0;
      const pairs = b.grid.pairs;
      while (i < pairs.length) {
        ensure(30);
        const rowY = y;
        for (let c = 0; c < cols && i < pairs.length; c++, i++) {
          const p = pairs[i];
          const x = MARGIN + c * colW;
          page.drawText(clip(p.name, font, 8.5, colW - 8), { x, y: rowY, size: 8.5, font, color: NEUTRAL });
          page.drawText(clip(p.value, font, 10.5, colW - 8), { x, y: rowY - 13, size: 10.5, font, color: INK });
        }
        y = rowY - 30;
      }
      continue;
    }

    // ── Firmas en fila (una columna por firmante) ──
    if (b.signature) {
      const n = b.signature.length;
      const colW = maxW / n;
      const areaH = 44;
      ensure(areaH + 44);
      const baseY = y;
      b.signature.forEach((s, idx) => {
        const cx = MARGIN + idx * colW + colW / 2;
        const sig = s.sig === "luis" ? sigLuis : s.sig === "eliud" ? sigEliud : null;
        if (sig) {
          const sw = 95;
          const sh = (sig.height / sig.width) * sw;
          page.drawImage(sig, { x: cx - sw / 2, y: baseY - areaH + 4, width: sw, height: sh });
        }
        const lineY = baseY - areaH;
        const lineW = colW - 24;
        page.drawLine({ start: { x: cx - lineW / 2, y: lineY }, end: { x: cx + lineW / 2, y: lineY }, thickness: 1, color: INK });
        const nm = clip(s.name.toUpperCase(), bold, 8.5, colW - 8);
        page.drawText(nm, { x: cx - bold.widthOfTextAtSize(nm, 8.5) / 2, y: lineY - 14, size: 8.5, font: bold, color: INK });
        const rl = s.role.toUpperCase();
        page.drawText(rl, { x: cx - font.widthOfTextAtSize(rl, 8) / 2, y: lineY - 25, size: 8, font, color: NEUTRAL });
      });
      y = baseY - areaH - 40;
      continue;
    }

    // ── Línea separadora ──
    if (b.rule) { ensure(6); hr(y, b.accent ? 2 : 1.2); y -= 4; continue; }

    // ── Fila de dos columnas (line item / total) ──
    if (b.row) {
      const th = b.row.th;
      const size = th ? 9 : (b.size ?? 11);
      const f = b.row.bold || th ? bold : font;
      const color = th ? NEUTRAL : (b.row.muted ? NEUTRAL : INK);
      const lh = size + (th ? 8 : 8);
      ensure(lh);
      const indent = b.row.indent ?? 0;
      const left = th ? b.row.left.toUpperCase() : b.row.left;
      const right = th ? b.row.right.toUpperCase() : b.row.right;
      const rightW = f.widthOfTextAtSize(right, size);
      page.drawText(clip(left, f, size, maxW - indent - rightW - 12), { x: MARGIN + indent, y, size, font: f, color });
      page.drawText(right, { x: PW - MARGIN - rightW, y, size, font: f, color });
      y -= lh;
      continue;
    }

    // ── Párrafo ──
    const size = b.size ?? 10.5;
    const f = b.bold ? bold : font;
    const lh = size + 4.5;
    const indent = b.indent ?? 0;
    const color = b.accent ? ACCENT : b.muted ? NEUTRAL : INK;
    const lines = wrapLines(b.text ?? "", f, size, maxW - indent);
    for (const line of lines) {
      ensure(lh);
      let x = MARGIN + indent;
      if (b.align === "center") x = (PW - f.widthOfTextAtSize(line, size)) / 2;
      page.drawText(line, { x, y, size, font: f, color });
      y -= lh;
    }
  }

  // ── Pie de página ──
  const pages = pdf.getPages();
  if (opts.footerBar) {
    const fb = opts.footerBar;
    pages.forEach((p, i) => {
      const fy = 40;
      p.drawLine({ start: { x: MARGIN, y: fy + 12 }, end: { x: PW - MARGIN, y: fy + 12 }, thickness: 2, color: DIVIDER });
      p.drawText(fb.left, { x: MARGIN, y: fy, size: 8, font, color: NEUTRAL });
      const rt = `${fb.right} · pág. ${i + 1}/${pages.length}`;
      p.drawText(rt, { x: PW - MARGIN - font.widthOfTextAtSize(rt, 8), y: fy, size: 8, font, color: NEUTRAL });
    });
  } else if (opts.footer) {
    pages.forEach((p, i) => {
      p.drawText(`${opts.footer} — pág. ${i + 1} de ${pages.length}`, {
        x: MARGIN, y: 32, size: 7.5, font, color: NEUTRAL,
      });
    });
  }

  return pdf.save();
}
