// Lector del reporte de TRANSACCIONES de BeatStars (Studio → Sales → Transactions).
//
// Es el único export de BeatStars que trae la venta completa: fecha, cliente,
// correo, beat y monto. El de "Sales Report" es un resumen por beat (no sirve
// para crear ventas) y el de "Customers" no trae fechas ni montos.
//
// OJO CON EL FORMATO: BeatStars NO escapa las comillas dentro del nombre del
// beat, así que un parser de CSV normal se pierde y parte los renglones a la
// mitad (probado: 12 filas basura de 170). Por eso aquí NO se usa un CSV
// genérico: cada transacción se ancla en su folio (`BS…_`) y los campos del
// final —que sí son números limpios— se leen de derecha a izquierda. Lo que
// queda en medio es el nombre del beat, comillas rotas incluidas.
//
// Módulo PURO: se puede probar sin servidor ni base de datos.

export interface TxBeatStars {
  /** Folio de BeatStars. Es la llave natural que evita importar dos veces. */
  invoice: string;
  /** YYYY-MM-DD, o null si el renglón no la traía. */
  fecha: string | null;
  cliente: string;
  email: string;
  /** Nombre del beat, ya sin comillas sueltas ni el sufijo (COLLABORATOR). */
  beat: string;
  /** Lo que pagó el cliente, en USD. */
  pagado: number;
  /** Lo que le queda a ARIDO tras la comisión de BeatStars, en USD. */
  neto: number;
  /** Comisión de BeatStars, en USD. */
  comision: number;
}

const MESES: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

/** "January 25, 2026 Sunday, 7:20:27 PM EST" → "2026-01-25" */
export function fechaDe(s: string): string | null {
  const m = /^(\w+)\s+(\d{1,2}),\s*(\d{4})/.exec((s || "").trim());
  if (!m) return null;
  const mes = MESES[m[1].toLowerCase()];
  if (!mes) return null;
  return `${m[3]}-${mes}-${m[2].padStart(2, "0")}`;
}

/**
 * Del título largo de BeatStars saca el nombre corto del beat.
 *
 *   '"LUNA DE MIEL" YNG NAZ TYPE BEAT (COLLABORATOR)'  →  'LUNA DE MIEL'
 *   '“NOSTALGICO” ESLABÓN ARMADO x DANNY LUX Type Beat' →  'NOSTALGICO'
 *   'Placoson Fuerza Type 120 Bpm G M'                  →  'Placoson Fuerza Type 120 Bpm G M'
 *
 * Se queda con lo que va entre comillas porque así están guardadas las ventas
 * que ya existen en el panel (LAGRIMA$, TE PERDI, EL QUEMA MAÍZ) — si aquí se
 * metiera el título completo, el mismo beat quedaría con dos nombres distintos
 * y nada empataría. Cuando no hay comillas se respeta el título tal cual.
 *
 * El orden importa: primero se normalizan y quitan las comillas de envoltura
 * que mete el CSV, y HASTA DESPUÉS el sufijo (COLLABORATOR) — al revés no
 * coincide, porque el sufijo no queda al final del texto.
 */
export function limpiarBeat(s: string): string {
  const t = (s || "")
    .replace(/[“”«»]/g, '"')
    .replace(/^["\s]+|["\s]+$/g, "")
    .replace(/\s*\(COLLABORATOR\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const entrecomillado = /^([^"]{2,60})"/.exec(t);
  return (entrecomillado ? entrecomillado[1] : t).trim();
}

const nEs = (v: string): number => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};

/** Lee los 7 campos finales (todos limpios) de derecha a izquierda. */
function cola(resto: string) {
  const m = /^(.*?),([\d.]*),([\d.]*),([\d.]*),"([^"]*)",([A-Z]*),([\d.]*),([\d.]*)$/.exec(resto);
  if (!m) return null;
  return { beat: limpiarBeat(m[1]), neto: nEs(m[2]), pagado: nEs(m[4]), comision: nEs(m[7]) };
}

export function leerTransacciones(csv: string): { tx: TxBeatStars[]; ignoradas: number } {
  const lineas = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const iCab = lineas.findIndex((l) => l.startsWith("Invoice Number"));
  if (iCab < 0) return { tx: [], ignoradas: 0 };

  const tx: TxBeatStars[] = [];
  let ultima: TxBeatStars | null = null;
  let ignoradas = 0;

  for (const l of lineas.slice(iCab + 1)) {
    if (/^BS[A-Z0-9]+_/i.test(l)) {
      const m = /^([^,]+),"([^"]*)","([^"]*)",([^,]*),"([^"]*)","([^"]*)",(.*)$/.exec(l);
      const c = m && cola(m[7]);
      if (!m || !c) { ignoradas++; continue; }
      // BeatStars pone "_not_available_" cuando el comprador no dejó nombre.
      const nom = m[5].trim();
      ultima = {
        invoice: m[1].trim(),
        fecha: fechaDe(m[2]),
        cliente: /^_?not[_ ]available_?$/i.test(nom) ? "" : nom,
        email: m[6].trim().toLowerCase(),
        ...c,
      };
      tx.push(ultima);
    } else if (l.startsWith(",,,,,,") && ultima) {
      // Segundo beat de la MISMA factura: hereda folio, fecha y cliente.
      const c = cola(l.slice(6));
      if (c?.beat) {
        tx.push({ invoice: ultima.invoice, fecha: ultima.fecha, cliente: ultima.cliente, email: ultima.email, ...c });
      }
    }
  }
  return { tx, ignoradas };
}

/**
 * Tipo de venta a partir de lo que quedó neto, usando el mismo vocabulario que
 * ya vive en la tabla (`Licencia básica` / `Licencia premium` / `Exclusividad`).
 * BeatStars no manda el nombre de la licencia en este reporte; el precio es la
 * única señal, y los escalones se ven claros en los datos reales.
 */
export function tipoDeVenta(neto: number): string {
  if (neto >= 150) return "Exclusividad";
  if (neto >= 65) return "Licencia premium";
  return "Licencia básica";
}

/**
 * Folio único por línea. La llave natural es el folio de BeatStars; cuando una
 * factura trae dos beats se le pega un sufijo. Esto es lo que hace que volver a
 * subir el mismo archivo NO duplique nada.
 */
export function folioDe(t: TxBeatStars, ocurrencia: number): string {
  const base = `BS-${t.invoice}`.slice(0, 58);
  return ocurrencia > 1 ? `${base}-${ocurrencia}` : base;
}
