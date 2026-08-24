import { Block, renderDocument, fechaLarga } from "./render";
import { fmtMoney, SELLER } from "./parts";
import { LOGO_ARIDO_NEGRO } from "./logo";
import { incluyeDePaquete } from "@/lib/servicios";
import { aplicarMerge } from "./plantilla-parse";
import { COTIZACION_TERMINOS_SEED } from "./plantilla-seeds";
import { subtotalDe, comisionValida } from "@/lib/comision";
import { tramosDe, ESQUEMA_LABEL, esEsquemaValido, type EsquemaPago } from "@/lib/esquema-pago";

/**
 * PDF de cotización — diseño "Modernist": logo + folio en el encabezado,
 * meta en columnas, datos del cliente en cuadrícula, tabla de detalle y pie.
 */

export interface QuoteItem {
  label: string;
  qty: number;
  unitPrice: number;
}

export interface QuoteData {
  folio: string;
  fecha?: Date;
  vigenciaDias?: number;
  moneda?: string;
  cliente: { nombre?: string | null; email?: string | null; telefono?: string | null; direccion?: string | null };
  items: QuoteItem[];
  descuento?: number;
  /**
   * Descuento por nivel de fidelidad, en pesos, YA CONGELADO al guardar la
   * cotización (lib/fidelidad.ts + la ruta que la crea). El PDF no vuelve a
   * calcular el % — si lo hiciera contra el nivel actual del cliente, una
   * cotización ya enviada podría mostrar un precio distinto al que se cobró.
   */
  descuentoFidelidad?: number;
  /** Saldo gastable (creditos_cliente) aplicado a esta cotización, en pesos. */
  creditoAplicado?: number;
  /** Comisión de la plataforma de cobro (PayPal). 0 = el cliente no la paga. */
  comisionPct?: number;
  notas?: string | null;
  /** Términos del pie (plantilla editable). Si se omite, usa la semilla. */
  terminos?: string | null;
  /** Solo servicios a la medida. Ausente = no se muestra desglose de pagos. */
  esquemaPago?: string | null;
  /** Solo cuando esquemaPago = "por_cancion". */
  numCanciones?: number | null;
}

export async function generateQuotePdf(d: QuoteData): Promise<Uint8Array> {
  const fecha = d.fecha ?? new Date();
  const moneda = (d.moneda || "MXN").toUpperCase();
  const vig = d.vigenciaDias ?? 15;
  const vence = new Date(fecha.getTime() + vig * 24 * 60 * 60 * 1000);

  // El desglose sale de `lib/comision.ts`, el MISMO que usan el formulario y la
  // ruta que guarda. El PDF es lo que firma el cliente: no puede diferir.
  //
  // La fidelidad NO se le pasa como % a `desglose()` aquí — ya viene congelada
  // en pesos (ver el comentario en `descuentoFidelidad` arriba). Por eso se
  // reproduce la MISMA fórmula a mano (descuento manual → fidelidad → comisión
  // → crédito) en vez de llamar a `desglose()`, que calcularía la comisión
  // sobre una base más grande (sin la fidelidad restada) y el total no
  // cuadraría con lo que la ruta ya guardó.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const descuentoFidelidad = Math.max(0, Number(d.descuentoFidelidad) || 0);
  const creditoAplicado = Math.max(0, Number(d.creditoAplicado) || 0);
  const subtotal = subtotalDe(d.items);
  const descuento = Math.max(0, Number(d.descuento) || 0);
  const comisionPct = comisionValida(d.comisionPct);
  const trasDescuentos = Math.max(0, subtotal - descuento - descuentoFidelidad);
  const comision = round2(trasDescuentos * (comisionPct / 100));
  const total = round2(trasDescuentos + comision - creditoAplicado);

  const blocks: Block[] = [
    // Meta en 3 columnas
    {
      grid: {
        cols: 3,
        pairs: [
          { name: "Fecha", value: fechaLarga(fecha) },
          { name: "Vigente hasta", value: fechaLarga(vence) },
          { name: "Contacto", value: `WhatsApp ${SELLER.whatsapp}` },
        ],
      },
      spaceBefore: 14,
    },
    { rule: true, spaceBefore: 6 },

    // Cliente
    { sectionLabel: "Cliente", spaceBefore: 14 },
    {
      grid: {
        cols: 2,
        pairs: [
          { name: "Nombre", value: d.cliente.nombre || "—" },
          { name: "Email", value: d.cliente.email || "—" },
          { name: "Teléfono", value: d.cliente.telefono || "—" },
          { name: "Dirección", value: d.cliente.direccion || "—" },
        ],
      },
      spaceBefore: 4,
    },
    { rule: true, spaceBefore: 4 },

    // Detalle
    { sectionLabel: "Detalle", spaceBefore: 14 },
    { row: { left: "Descripción", right: "Precio", th: true }, spaceBefore: 4 },
    { rule: true, spaceBefore: 2 },
    ...d.items.flatMap<Block>((i) => {
      const line = (Number(i.qty) || 0) * (Number(i.unitPrice) || 0);
      const qtyTxt = (Number(i.qty) || 0) > 1 ? ` (x${i.qty})` : "";
      const blocks: Block[] = [{ row: { left: `${i.label}${qtyTxt}`, right: fmtMoney(line, moneda) }, spaceBefore: 5 }];
      const inc = incluyeDePaquete(i.label);
      if (inc.length) blocks.push({ text: `Incluye: ${inc.join(" · ")}`, muted: true, size: 8.5, indent: 2, spaceBefore: 1 });
      return blocks;
    }),
    { rule: true, spaceBefore: 4 },
  ];

  // El subtotal se enseña si hay algo que desglosar; si no, un "Subtotal"
  // idéntico al "TOTAL" solo estorba.
  if (descuento > 0 || descuentoFidelidad > 0 || comision > 0 || creditoAplicado > 0) {
    blocks.push({ row: { left: "Subtotal", right: fmtMoney(subtotal, moneda), muted: true }, spaceBefore: 4 });
  }
  if (descuento > 0) {
    blocks.push({ row: { left: "Descuento", right: `- ${fmtMoney(descuento, moneda)}`, muted: true }, spaceBefore: 2 });
  }
  if (descuentoFidelidad > 0) {
    // Se nombra "fidelidad" a propósito: es un beneficio que se ganó, no una
    // rebaja arbitraria — vale la pena que lo vea etiquetado así.
    blocks.push({
      row: { left: "Descuento por fidelidad", right: `- ${fmtMoney(descuentoFidelidad, moneda)}`, muted: true },
      spaceBefore: 2,
    });
  }
  if (comision > 0) {
    // Se nombra la plataforma a propósito: el cliente tiene derecho a saber por
    // qué paga ese extra, y así no se lee como un cargo inventado.
    blocks.push({
      row: { left: `Comisión PayPal (${comisionPct}%)`, right: fmtMoney(comision, moneda), muted: true },
      spaceBefore: 2,
    });
  }
  if (creditoAplicado > 0) {
    blocks.push({
      row: { left: "Crédito aplicado", right: `- ${fmtMoney(creditoAplicado, moneda)}`, muted: true },
      spaceBefore: 2,
    });
  }
  blocks.push({ row: { left: "TOTAL", right: fmtMoney(total, moneda), bold: true }, size: 13, spaceBefore: 6 });
  if (comision > 0) {
    blocks.push({
      text: `Este total incluye la comisión de PayPal. Si prefieres pagar por transferencia, el total es ${fmtMoney(trasDescuentos - creditoAplicado, moneda)}.`,
      muted: true, size: 8.5, spaceBefore: 3,
    });
  }

  // Forma de pago: solo si se eligió un esquema (servicios a la medida). Va
  // ANTES de las notas porque es información contractual, no un comentario.
  if (esEsquemaValido(d.esquemaPago)) {
    const esquema = d.esquemaPago as EsquemaPago;
    const tramos = tramosDe(esquema, total, d.numCanciones);
    blocks.push({ sectionLabel: "Forma de pago", spaceBefore: 16 });
    blocks.push({ text: ESQUEMA_LABEL[esquema], muted: true, size: 9, spaceBefore: 2 });
    for (const t of tramos) {
      blocks.push({ row: { left: t.label, right: fmtMoney(t.monto, moneda) }, size: 10, spaceBefore: 4 });
    }
  }

  if (d.notas && d.notas.trim()) {
    blocks.push({ sectionLabel: "Notas", spaceBefore: 16 });
    blocks.push({ text: d.notas.trim(), size: 10, spaceBefore: 4 });
  }

  // Términos del pie: plantilla editable (o semilla), con {{moneda}} resuelto.
  const terminos = aplicarMerge(d.terminos || COTIZACION_TERMINOS_SEED, { moneda });
  for (const parrafo of terminos.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    blocks.push({ text: parrafo.replace(/\n/g, " "), muted: true, size: 9, spaceBefore: 18 });
  }

  return renderDocument(blocks, {
    header: { logo: LOGO_ARIDO_NEGRO, logoWidth: 74, rightLabel: "Cotización", rightTitle: `Folio ${d.folio}` },
    footerBar: { left: SELLER.brand, right: `Cotización ${d.folio}` },
  });
}
