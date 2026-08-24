import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from "pdf-lib";
import { SIGN_ELIUD, SIGN_LUIS } from "./signatures";

/**
 * Certificado de Licencia (no exclusiva) — Basic / Premium / Premium Plus.
 * Se genera y adjunta al correo de compra. A diferencia de la Exclusiva (compraventa
 * que firma el cliente), esta es una licencia OTORGADA por Árido Music Group:
 * va firmada solo por el licenciante, el cliente la conserva como comprobante.
 */

export interface LicenseCertData {
  buyerName: string;
  buyerEmail: string;
  beatTitle: string;
  licenseLabel: string; // "Premium License"
  badge: string; // "WAV + MP3"
  price: number;
  currency: string;
  features: string[];
  notIncluded: string[];
  files: string[];
  folio: string;
  date?: Date;
  lang?: "es" | "en";
}

function sanitize(s: string): string {
  return (s || "")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
function fechaLarga(d: Date, lang: "es" | "en"): string {
  if (lang === "en") {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

interface Block {
  text?: string;
  bold?: boolean;
  size?: number;
  spaceBefore?: number;
  align?: "center";
  indent?: number;
  color?: [number, number, number];
}

export async function generateLicenseCertificate(d: LicenseCertData): Promise<Uint8Array> {
  const lang = d.lang ?? "es";
  const date = d.date ?? new Date();
  const price = `$${d.price.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${d.currency.toUpperCase()}`;
  const es = lang === "es";

  const t = es
    ? {
        title: "CERTIFICADO DE LICENCIA",
        intro: `Por medio del presente, ÁRIDO MUSIC GROUP — representado por Ahmed Eliud López Contreras y Luis Alberto Rocha Ornelas — ("EL LICENCIANTE") otorga a ${d.buyerName} (${d.buyerEmail}) ("EL LICENCIATARIO") una licencia ${d.licenseLabel} NO EXCLUSIVA de uso sobre la instrumental "${d.beatTitle}", conforme a los términos siguientes:`,
        dataHdr: "DATOS DE LA LICENCIA",
        lic: "Licencia", beat: "Instrumental", amount: "Monto", files: "Archivos entregados", folio: "Folio", date: "Fecha",
        inc: "LO QUE INCLUYE ESTA LICENCIA",
        notinc: "NO INCLUYE",
        cond: "CONDICIONES",
        clauses: [
          "1. Licencia NO EXCLUSIVA: la instrumental puede seguir siendo licenciada a otros artistas. Si deseas uso exclusivo y que el beat se retire de la venta, adquiere la Licencia Exclusiva.",
          "2. EL LICENCIANTE conserva en todo momento la titularidad de los derechos de autor sobre la instrumental.",
          '3. EL LICENCIATARIO se obliga a acreditar la producción como "Prod. Latino Gang Beats" (o "Producido por Árido Music Group") en su lanzamiento.',
          "4. Esta licencia ampara la creación de una (1) obra o grabación del LICENCIATARIO. Queda prohibido revender, redistribuir, regalar o transferir la instrumental por separado.",
          "5. La licencia entra en vigor con el pago confirmado, es de alcance mundial y se rige por los límites indicados arriba.",
        ],
        grantedBy: "OTORGADO POR ÁRIDO MUSIC GROUP",
        role: "LICENCIANTE",
        foot: "Árido Music Group · Latino Gang Beats — Certificado de Licencia",
      }
    : {
        title: "LICENSE CERTIFICATE",
        intro: `Hereby, ÁRIDO MUSIC GROUP — represented by Ahmed Eliud López Contreras and Luis Alberto Rocha Ornelas — ("THE LICENSOR") grants to ${d.buyerName} (${d.buyerEmail}) ("THE LICENSEE") a ${d.licenseLabel} NON-EXCLUSIVE license to use the instrumental "${d.beatTitle}", under the following terms:`,
        dataHdr: "LICENSE DETAILS",
        lic: "License", beat: "Instrumental", amount: "Amount", files: "Delivered files", folio: "Ref.", date: "Date",
        inc: "WHAT THIS LICENSE INCLUDES",
        notinc: "NOT INCLUDED",
        cond: "TERMS",
        clauses: [
          "1. NON-EXCLUSIVE license: the instrumental may continue to be licensed to other artists. For exclusive use with the beat removed from sale, purchase the Exclusive License.",
          "2. THE LICENSOR retains ownership of the copyright in the instrumental at all times.",
          '3. THE LICENSEE must credit the production as "Prod. Latino Gang Beats" (or "Produced by Árido Music Group") on the release.',
          "4. This license covers the creation of one (1) work or recording by THE LICENSEE. Reselling, redistributing, giving away or transferring the instrumental on its own is prohibited.",
          "5. The license takes effect upon confirmed payment, is worldwide in scope and is governed by the limits stated above.",
        ],
        grantedBy: "GRANTED BY ÁRIDO MUSIC GROUP",
        role: "LICENSOR",
        foot: "Árido Music Group · Latino Gang Beats — License Certificate",
      };

  const blocks: Block[] = [
    { text: t.title, bold: true, size: 16, align: "center", spaceBefore: 0 },
    { text: "Árido Music Group · Latino Gang Beats", size: 9, align: "center", spaceBefore: 6, color: [0.45, 0.45, 0.45] },
    { text: t.intro, spaceBefore: 20 },

    { text: t.dataHdr, bold: true, size: 11, spaceBefore: 18 },
    { text: `${t.lic}: ${d.licenseLabel} (${d.badge})`, spaceBefore: 8 },
    { text: `${t.beat}: ${d.beatTitle}`, spaceBefore: 4 },
    { text: `${t.amount}: ${price}`, spaceBefore: 4 },
    { text: `${t.files}: ${d.files.join("  ·  ")}`, spaceBefore: 4 },
    { text: `${t.folio}: ${d.folio}     ${t.date}: ${fechaLarga(date, lang)}`, spaceBefore: 4 },

    { text: t.inc, bold: true, size: 11, spaceBefore: 18 },
    ...d.features.map((f) => ({ text: `+ ${f}`, spaceBefore: 4, indent: 12 })),
  ];

  if (d.notIncluded.length) {
    blocks.push({ text: t.notinc, bold: true, size: 11, spaceBefore: 16 });
    d.notIncluded.forEach((f) => blocks.push({ text: `-  ${f}`, spaceBefore: 4, indent: 12, color: [0.4, 0.4, 0.4] }));
  }

  blocks.push({ text: t.cond, bold: true, size: 11, spaceBefore: 18 });
  t.clauses.forEach((c) => blocks.push({ text: c, spaceBefore: 6 }));

  // ── Render ─────────────────────────────────────────────
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const sigEliud = await pdf.embedPng(Buffer.from(SIGN_ELIUD, "base64"));
  const sigLuis = await pdf.embedPng(Buffer.from(SIGN_LUIS, "base64"));

  const PW = 612, PH = 792, MARGIN = 64, BOTTOM = 70;
  const maxW = PW - MARGIN * 2;
  const ink = rgb(0.08, 0.08, 0.08);
  let page: PDFPage = pdf.addPage([PW, PH]);
  let y = PH - MARGIN;

  const wrap = (text: string, f: PDFFont, size: number, width: number): string[] => {
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
  const ensure = (h: number) => { if (y - h < BOTTOM) { page = pdf.addPage([PW, PH]); y = PH - MARGIN; } };

  for (const b of blocks) {
    y -= b.spaceBefore ?? 8;
    const size = b.size ?? 10.5;
    const f = b.bold ? bold : font;
    const lh = size + 4;
    const indent = b.indent ?? 0;
    const color = b.color ? rgb(...b.color) : ink;
    for (const line of wrap(b.text ?? "", f, size, maxW - indent)) {
      ensure(lh);
      let x = MARGIN + indent;
      if (b.align === "center") x = (PW - f.widthOfTextAtSize(line, size)) / 2;
      page.drawText(line, { x, y, size, font: f, color });
      y -= lh;
    }
  }

  // Firma del licenciante (ambos productores)
  y -= 36;
  ensure(120);
  page.drawText(t.grantedBy, { x: MARGIN, y, size: 10, font: bold, color: ink });
  y -= 6;
  for (const s of [
    { sig: sigEliud, name: "AHMED ELIUD LÓPEZ CONTRERAS" },
    { sig: sigLuis, name: "LUIS ALBERTO ROCHA ORNELAS" },
  ]) {
    const sigW = 110;
    const sigH = (s.sig.height / s.sig.width) * sigW;
    ensure(sigH + 44);
    const lineY = y - sigH - 2;
    page.drawImage(s.sig, { x: MARGIN + 12, y: lineY + 3, width: sigW, height: sigH });
    page.drawText("_______________________________________", { x: MARGIN, y: lineY, size: 11, font, color: ink });
    y = lineY - 15;
    page.drawText(s.name, { x: MARGIN, y, size: 9.5, font: bold, color: ink });
    y -= 12;
    page.drawText(t.role, { x: MARGIN, y, size: 8.5, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 22;
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) =>
    p.drawText(`${t.foot} — ${d.folio} — ${i + 1}/${pages.length}`, {
      x: MARGIN, y: 34, size: 7.5, font, color: rgb(0.55, 0.55, 0.55),
    })
  );

  return pdf.save();
}
