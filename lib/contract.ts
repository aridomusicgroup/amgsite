import { generateContractPdf } from "./pdf/contracts";

/**
 * Adaptador de compatibilidad: el "Acuerdo de Producción Musical" (exclusividad)
 * que se dispara en la compra de la licencia Exclusiva. La lógica de render y el
 * texto legal viven ahora en `lib/pdf/` (motor compartido con las cotizaciones y
 * los demás contratos); aquí solo se mapea la firma original que usa el webhook.
 */

export interface ContractData {
  buyerName: string;
  buyerAddress: string;
  buyerPhone: string;
  buyerEmail: string;
  beatTitle: string;
  price: number;
  currency: string;
  date?: Date;
}

export async function generateExclusiveContract(d: ContractData): Promise<Uint8Array> {
  return generateContractPdf("exclusiva", {
    folio: d.beatTitle,
    fecha: d.date,
    moneda: d.currency,
    monto: d.price,
    concepto: d.beatTitle,
    cliente: {
      nombre: d.buyerName,
      email: d.buyerEmail,
      telefono: d.buyerPhone,
      direccion: d.buyerAddress,
    },
  });
}
