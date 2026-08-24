import { Block } from "./render";
import { SELLER } from "./parts";

/**
 * Convierte el TEXTO editable de una plantilla (con campos {{...}} y un markup
 * mínimo) en bloques para el motor de PDF. Así el equipo edita los textos de
 * contratos/cotizaciones desde el panel sin tocar código.
 *
 * Markup:
 *   línea en blanco   → nuevo párrafo
 *   # Encabezado      → título de sección centrado en negritas
 *   - viñeta          → punto con sangría
 *   {{campo}}         → dato del documento (ver MergeCtx)
 */

export interface MergeCtx {
  cliente?: string | null;
  obra?: string | null;
  monto?: number;
  moneda?: string;
  fecha?: string; // ya formateada (ej. "16 de julio del año 2026")
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
}

/** Formato de dinero para contratos: MXN → "MN", otra → código (USD…). */
function money(n: number, moneda: string): string {
  const cur = (moneda || "MXN").toUpperCase();
  const val = (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${val} ${cur === "MXN" ? "MN" : cur}`;
}

/** Reemplaza los {{campos}} del texto con los datos del documento. */
export function aplicarMerge(texto: string, ctx: MergeCtx): string {
  const moneda = (ctx.moneda || "MXN").toUpperCase();
  const map: Record<string, string> = {
    cliente: ctx.cliente || "—",
    obra: (ctx.obra || "—").toUpperCase(),
    monto: money(ctx.monto ?? 0, moneda),
    moneda,
    fecha: ctx.fecha || "",
    cliente_direccion: ctx.direccion || "—",
    cliente_telefono: ctx.telefono || "—",
    cliente_email: ctx.email || "—",
    vendedor: SELLER.names,
    vendedor_direccion: SELLER.address,
    vendedor_tel: SELLER.whatsapp,
  };
  return String(texto || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => {
    const key = String(k).toLowerCase();
    return key in map ? map[key] : m; // campo desconocido: se deja literal para que se note
  });
}

/** Campos disponibles (para la chuleta del editor). */
export const CAMPOS_PLANTILLA: { campo: string; desc: string }[] = [
  { campo: "{{cliente}}", desc: "Nombre del cliente" },
  { campo: "{{obra}}", desc: "Beat / obra (en mayúsculas)" },
  { campo: "{{monto}}", desc: "Precio con moneda (ej. $8,600.00 MN)" },
  { campo: "{{moneda}}", desc: "MXN / USD" },
  { campo: "{{fecha}}", desc: "Fecha larga (ej. 16 de julio del año 2026)" },
  { campo: "{{cliente_direccion}}", desc: "Dirección del cliente" },
  { campo: "{{cliente_telefono}}", desc: "Teléfono del cliente" },
  { campo: "{{cliente_email}}", desc: "Correo del cliente" },
  { campo: "{{vendedor}}", desc: "Nombres de los productores (ARIDO)" },
  { campo: "{{vendedor_direccion}}", desc: "Domicilio de ARIDO" },
  { campo: "{{vendedor_tel}}", desc: "WhatsApp de ARIDO" },
];

/** Parsea el texto (ya con merge aplicado) a bloques del renderer. */
export function textoABloques(texto: string): Block[] {
  const lines = String(texto || "").replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) { blocks.push({ text: para.join(" "), spaceBefore: 9 }); para = []; }
  };
  for (const raw of lines) {
    const t = raw.trim();
    if (t === "") { flush(); continue; }
    if (t.startsWith("# ")) {
      flush();
      blocks.push({ text: t.slice(2).trim(), bold: true, align: "center", size: 12, spaceBefore: 14 });
      continue;
    }
    if (/^[-•]\s+/.test(t)) {
      flush();
      blocks.push({ text: "- " + t.replace(/^[-•]\s+/, ""), indent: 16, spaceBefore: 4 });
      continue;
    }
    para.push(t);
  }
  flush();
  return blocks;
}

/** Atajo: aplica merge y devuelve bloques. */
export function plantillaABloques(texto: string, ctx: MergeCtx): Block[] {
  return textoABloques(aplicarMerge(texto, ctx));
}
