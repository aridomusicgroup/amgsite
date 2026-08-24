import { QuoteItem } from "../quote";

/** Datos comunes para cualquier plantilla de contrato. */
export interface ContractData {
  folio: string;
  fecha?: Date;
  moneda?: string;
  monto?: number;
  /** Beat / producción / servicio objeto del contrato. */
  concepto?: string;
  cliente: { nombre?: string | null; email?: string | null; telefono?: string | null; direccion?: string | null };
  /** Line items opcionales (para producción/servicio con desglose). */
  items?: QuoteItem[];
  /** Cláusulas libres (plantilla genérica). */
  clausulasExtra?: string | null;
}

export type ContractTipo = "beat_personalizado" | "exclusiva" | "produccion" | "servicio" | "ep_album" | "generico";
