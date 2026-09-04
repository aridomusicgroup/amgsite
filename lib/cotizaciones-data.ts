import { supabaseAdmin } from "@/lib/supabase/admin";
import { QuoteItem } from "@/lib/pdf/quote";
import { ContractTipo } from "@/lib/pdf/contracts";
import { familiaDeCotizacion, type Familia } from "@/lib/acuerdos/familias";
import { ACUERDO_VERSIONES } from "@/lib/acuerdos/acuerdo-cliente";

/**
 * Capa de datos de Cotizaciones y Contratos (Supabase, service-role).
 * Los line items se guardan como JSON; el PDF se regenera on-demand a partir de
 * estos datos, así los documentos son editables y versionables.
 */

export const COT_ESTADOS = ["borrador", "enviada", "aceptada", "rechazada", "vencida"] as const;
export const COT_ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador", enviada: "Enviada", aceptada: "Aceptada", rechazada: "Rechazada", vencida: "Vencida",
};

export const CONTRATO_ESTADOS = ["borrador", "enviado", "firmado", "cancelado"] as const;
export const CONTRATO_ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador", enviado: "Enviado", firmado: "Firmado", cancelado: "Cancelado",
};

export interface Cotizacion {
  id: string;
  folio: string | null;
  /** Qué tipo de servicio es. Decide el acuerdo a firmar antes del anticipo (ver lib/acuerdos). null = sin clasificar (cotizaciones viejas). */
  tipo: ContractTipo | null;
  /** Solo relevante para servicios a la medida. null = "estándar" (50/50) por default. */
  esquema_pago: string | null;
  /** Solo cuando esquema_pago = "por_cancion", o el tipo es "ep_album". */
  num_canciones: number | null;
  /** Solo cuando tipo = "ep_album": cuál de los dos es. null = sin especificar (cotizaciones viejas). */
  ep_album_formato: "ep" | "album" | null;
  contacto_id: string | null;
  cliente_nombre: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  moneda: string;
  /** Solo cuando la moneda no es peso. Se guarda para que el MXN sea auditable. */
  tipo_cambio: number | null;
  items: QuoteItem[];
  descuento: number;
  /** Congelado al guardar — no se recalcula si el cliente sube de nivel después. */
  descuento_fidelidad: number;
  /** Cuánto de su saldo gastable (creditos_cliente) se aplicó aquí. */
  credito_aplicado: number;
  /** El staff apagó el descuento a propósito para esta cotización (aunque el esquema/tipo/nivel calificaran). */
  sin_descuento_fidelidad: boolean;
  /** Comisión de PayPal que se le cobra al cliente. 0 = no paga por PayPal. */
  comision_pct: number;
  /** En la moneda del documento, con comisión ya incluida. */
  total: number;
  /** El mismo total ya en pesos (lo que leen Dashboard y Finanzas). */
  total_mxn: number | null;
  notas: string | null;
  vigencia_dias: number;
  estado: string;
  creado_por: string | null;
  created_at: string;
}

export interface Contrato {
  id: string;
  folio: string | null;
  tipo: ContractTipo;
  cotizacion_id: string | null;
  venta_id: string | null;
  proyecto_id: string | null;
  contacto_id: string | null;
  cliente_nombre: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  moneda: string;
  /** Solo cuando la moneda no es peso. Se guarda para que el MXN sea auditable. */
  tipo_cambio: number | null;
  /** En la moneda del documento. */
  monto: number;
  /** El mismo monto ya en pesos (lo que leen Dashboard y Finanzas). */
  monto_mxn: number | null;
  concepto: string | null;
  items: QuoteItem[];
  clausulas_extra: string | null;
  notas: string | null;
  estado: string;
  creado_por: string | null;
  created_at: string;
}

function asItems(v: unknown): QuoteItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      label: String(x.label ?? ""),
      qty: Number(x.qty) || 0,
      unitPrice: Number(x.unitPrice) || 0,
    }))
    .filter((i) => i.label);
}

export async function getCotizaciones(): Promise<Cotizacion[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("cotizaciones")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    folio: (c.folio as string | null) ?? null,
    tipo: (c.tipo as ContractTipo | null) ?? null,
    esquema_pago: (c.esquema_pago as string | null) ?? null,
    num_canciones: c.num_canciones != null ? Number(c.num_canciones) : null,
    ep_album_formato: (c.ep_album_formato as "ep" | "album" | null) ?? null,
    contacto_id: (c.contacto_id as string | null) ?? null,
    cliente_nombre: (c.cliente_nombre as string | null) ?? null,
    cliente_email: (c.cliente_email as string | null) ?? null,
    cliente_telefono: (c.cliente_telefono as string | null) ?? null,
    cliente_direccion: (c.cliente_direccion as string | null) ?? null,
    moneda: (c.moneda as string) || "MXN",
    tipo_cambio: Number(c.tipo_cambio) > 0 ? Number(c.tipo_cambio) : null,
    items: asItems(c.items),
    descuento: Number(c.descuento) || 0,
    descuento_fidelidad: Number(c.descuento_fidelidad) || 0,
    credito_aplicado: Number(c.credito_aplicado) || 0,
    sin_descuento_fidelidad: !!c.sin_descuento_fidelidad,
    comision_pct: Number(c.comision_pct) || 0,
    total: Number(c.total) || 0,
    total_mxn: Number(c.total_mxn) > 0 ? Number(c.total_mxn) : null,
    notas: (c.notas as string | null) ?? null,
    vigencia_dias: Number(c.vigencia_dias) || 15,
    estado: (c.estado as string) || "borrador",
    creado_por: (c.creado_por as string | null) ?? null,
    created_at: c.created_at as string,
  }));
}

/** Rastro por cotización: folios de la venta, el proyecto y el contrato ligados. */
export interface RastroCot {
  venta: string | null;
  proyecto: string | null;
  contrato: string | null;
  /** Id del proyecto: el rastro enlaza a su ficha, no sólo al tablero. */
  proyectoId: string | null;
  /** null = ese tipo de servicio no tiene acuerdo (p. ej. "generico"). */
  acuerdo: "firmado" | "pendiente" | null;
}

export async function getRastroCotizaciones(): Promise<Record<string, RastroCot>> {
  const sb = supabaseAdmin();
  const [ventasRes, proyectosRes, contratosRes, cotRes] = await Promise.all([
    sb.from("ventas").select("folio, cotizacion_id").not("cotizacion_id", "is", null),
    sb.from("proyectos").select("id, folio, cotizacion_id").not("cotizacion_id", "is", null),
    sb.from("contratos").select("folio, cotizacion_id").not("cotizacion_id", "is", null),
    sb.from("cotizaciones").select("id, tipo, cliente_email"),
  ]);
  const out: Record<string, RastroCot> = {};
  const ensure = (id: string) => (out[id] ??= { venta: null, proyecto: null, contrato: null, proyectoId: null, acuerdo: null });
  for (const v of ventasRes.data ?? []) if (v.cotizacion_id) ensure(v.cotizacion_id as string).venta = (v.folio as string) ?? null;
  for (const p of proyectosRes.data ?? []) {
    if (!p.cotizacion_id) continue;
    const e = ensure(p.cotizacion_id as string);
    e.proyecto = (p.folio as string) ?? null;
    e.proyectoId = (p.id as string) ?? null;
  }
  for (const c of contratosRes.data ?? []) if (c.cotizacion_id) ensure(c.cotizacion_id as string).contrato = (c.folio as string) ?? null;

  // Acuerdo: solo para las cotizaciones cuyo tipo mapea a una familia (las
  // "generico" no tienen texto legal que ofrecer y se quedan en null).
  const cots = (cotRes.data ?? []) as Array<{ id: string; tipo: string | null; cliente_email: string | null }>;
  const relevantes = cots
    .map((c) => ({ ...c, familia: familiaDeCotizacion(c.tipo) }))
    .filter((c): c is typeof c & { familia: Familia; cliente_email: string } => !!c.familia && !!c.cliente_email);

  if (relevantes.length) {
    const emails = [...new Set(relevantes.map((c) => c.cliente_email.toLowerCase()))];
    const [{ data: firmas }, { data: invites }] = await Promise.all([
      sb.from("cliente_acuerdos").select("email, familia, version").in("email", emails),
      sb.from("acuerdo_invitaciones").select("email, familia").in("email", emails).is("usado_at", null),
    ]);
    const firmadas = new Set(
      (firmas ?? [])
        .filter((f) => f.version === ACUERDO_VERSIONES[f.familia as Familia])
        .map((f) => `${String(f.email).toLowerCase()}|${f.familia}`),
    );
    const invitadas = new Set((invites ?? []).map((i) => `${String(i.email).toLowerCase()}|${i.familia}`));
    for (const c of relevantes) {
      const key = `${c.cliente_email.toLowerCase()}|${c.familia}`;
      ensure(c.id).acuerdo = firmadas.has(key) ? "firmado" : invitadas.has(key) ? "pendiente" : null;
    }
  }

  return out;
}

export async function getContratos(): Promise<Contrato[]> {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("contratos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    folio: (c.folio as string | null) ?? null,
    tipo: ((c.tipo as string) || "generico") as ContractTipo,
    cotizacion_id: (c.cotizacion_id as string | null) ?? null,
    venta_id: (c.venta_id as string | null) ?? null,
    proyecto_id: (c.proyecto_id as string | null) ?? null,
    contacto_id: (c.contacto_id as string | null) ?? null,
    cliente_nombre: (c.cliente_nombre as string | null) ?? null,
    cliente_email: (c.cliente_email as string | null) ?? null,
    cliente_telefono: (c.cliente_telefono as string | null) ?? null,
    cliente_direccion: (c.cliente_direccion as string | null) ?? null,
    moneda: (c.moneda as string) || "MXN",
    tipo_cambio: Number(c.tipo_cambio) > 0 ? Number(c.tipo_cambio) : null,
    monto: Number(c.monto) || 0,
    monto_mxn: Number(c.monto_mxn) > 0 ? Number(c.monto_mxn) : null,
    concepto: (c.concepto as string | null) ?? null,
    items: asItems(c.items),
    clausulas_extra: (c.clausulas_extra as string | null) ?? null,
    notas: (c.notas as string | null) ?? null,
    estado: (c.estado as string) || "borrador",
    creado_por: (c.creado_por as string | null) ?? null,
    created_at: c.created_at as string,
  }));
}
