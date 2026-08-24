import { Block } from "./render";

/**
 * Piezas reutilizables para los PDFs de ARIDO (cotizaciones y contratos):
 * datos legales del vendedor, encabezado de marca, formato de dinero y filas de
 * line items. Fuente de los datos legales: contrato de exclusividad original.
 */

export const SELLER = {
  brand: "Árido Music Group · Latino Gang Beats",
  names: "Ahmed Eliud López Contreras y Luis Alberto Rocha Ornelas",
  address: "Aramberri #1701, La Finca, Matehuala, San Luis Potosí, C.P. 78700",
  phone: "+52 488 178 0213",
  whatsapp: "+52 488 178 0213",
  email: "latinogangbeats@gmail.com",
  web: "aridomusicgroup.com",
} as const;

export function fmtMoney(n: number, currency = "MXN"): string {
  return `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency.toUpperCase()}`;
}

/** Encabezado de marca: título del documento + datos del emisor. */
export function brandHeader(docTitle: string, folio: string, fecha: string): Block[] {
  return [
    { text: SELLER.brand, bold: true, size: 13, align: "center", spaceBefore: 0 },
    { text: docTitle.toUpperCase(), bold: true, size: 16, align: "center", spaceBefore: 10 },
    { row: { left: `Folio: ${folio}`, right: `Fecha: ${fecha}`, muted: true }, size: 9.5, spaceBefore: 12 },
    {
      text: `${SELLER.names} · ${SELLER.web} · WhatsApp ${SELLER.whatsapp} · ${SELLER.email}`,
      muted: true, size: 8.5, spaceBefore: 4,
    },
    { rule: true, spaceBefore: 8 },
  ];
}

/** Bloque de datos del cliente. */
export function clientBlock(d: {
  nombre?: string | null; email?: string | null; telefono?: string | null; direccion?: string | null;
}): Block[] {
  const blocks: Block[] = [
    { text: "CLIENTE", bold: true, size: 10, spaceBefore: 14 },
    { text: d.nombre || "—", size: 10.5, spaceBefore: 6 },
  ];
  const linea2 = [d.email, d.telefono].filter(Boolean).join(" · ");
  if (linea2) blocks.push({ text: linea2, muted: true, size: 9.5, spaceBefore: 3 });
  if (d.direccion) blocks.push({ text: d.direccion, muted: true, size: 9.5, spaceBefore: 3 });
  return blocks;
}
