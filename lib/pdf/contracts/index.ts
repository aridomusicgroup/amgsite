import { renderDocument, Block, fechaLarga } from "../render";
import { SELLER } from "../parts";
import { LOGO_ARIDO_NEGRO } from "../logo";
import { SIGN_LUIS, SIGN_ELIUD } from "@/lib/signatures";
import { plantillaABloques } from "../plantilla-parse";
import { getPlantillaContrato } from "@/lib/plantillas-data";
import { ContractData, ContractTipo } from "./types";

export type { ContractData, ContractTipo } from "./types";

/** Etiquetas de las plantillas de contrato (dropdown del panel + registro). */
export const CONTRACT_LABELS: Record<ContractTipo, string> = {
  beat_personalizado: "Beat personalizado (Acuerdo de Producción 2026, MXN)",
  exclusiva: "Exclusiva (compraventa de beat)",
  produccion: "Producción a la medida",
  servicio: "Servicio suelto (mezcla/master/grabación)",
  ep_album: "EP / Álbum",
  generico: "Genérico / editable",
};

export const CONTRACT_TIPOS = (Object.keys(CONTRACT_LABELS) as ContractTipo[]).map(
  (id) => ({ id, label: CONTRACT_LABELS[id] })
);

/** Bloque de firmas en fila: cliente (comprador) + los dos socios de ARIDO. */
function firmas(cliente: string): Block {
  return {
    signature: [
      { name: cliente, role: "COMPRADOR" },
      { name: "AHMED ELIUD LÓPEZ CONTRERAS", role: "VENDEDOR", sig: "eliud" },
      { name: "LUIS ALBERTO ROCHA ORNELAS", role: "VENDEDOR", sig: "luis" },
    ],
    spaceBefore: 50,
  };
}

/** Arma el PDF del contrato a partir del texto de la plantilla (título + cuerpo). */
export async function generateContractPdfFromText(
  titulo: string,
  cuerpo: string,
  d: ContractData
): Promise<Uint8Array> {
  const cliente = d.cliente.nombre || d.cliente.email || "—";
  const cuerpoBlocks = plantillaABloques(cuerpo, {
    cliente,
    obra: d.concepto,
    monto: d.monto,
    moneda: d.moneda,
    fecha: fechaLarga(d.fecha ?? new Date()),
    direccion: d.cliente.direccion,
    telefono: d.cliente.telefono,
    email: d.cliente.email,
  });
  const blocks: Block[] = [
    { text: titulo, bold: true, size: 14, align: "center", spaceBefore: 0 },
    ...cuerpoBlocks,
    firmas(cliente),
  ];
  return renderDocument(blocks, {
    header: { logo: LOGO_ARIDO_NEGRO, logoWidth: 66 },
    footerBar: { left: SELLER.brand, right: d.folio },
    signatures: { luis: SIGN_LUIS, eliud: SIGN_ELIUD },
  });
}

/** Genera el PDF de un contrato leyendo su plantilla (editada o semilla). */
export async function generateContractPdf(tipo: ContractTipo, d: ContractData): Promise<Uint8Array> {
  const pl = await getPlantillaContrato(tipo);
  return generateContractPdfFromText(pl.titulo, pl.cuerpo, d);
}
