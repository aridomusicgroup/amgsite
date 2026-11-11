import "server-only";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { firmaAcuerdoProduccionEmail } from "@/lib/emails";
import { conseguirEnlaceProduccion } from "./invitaciones";
import type { AcuerdoSeed } from "./seeds";
import {
  ACUERDO_PRODUCCION_SEED,
  ACUERDO_PRODUCCION_TIPO,
  debeBloquearProduccion,
  fechaLarga,
  huecosSinResolver,
  renderProduccion,
  tituloDeProduccion,
  type VariablesProduccion,
} from "./produccion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const FROM = "Latino Gang Beats <pedidos@aridomusicgroup.com>";

/** Lo mínimo de una cotización para armar y mandar su acuerdo individual. */
export interface CotAcuerdo {
  id: string;
  folio: string;
  cliente_nombre: string | null;
  cliente_email: string | null;
  items: Array<{ label?: unknown }>;
  created_at: string | null;
  acuerdo_individual: boolean;
}

/**
 * El texto vigente: el editado desde Plantillas (`acuerdo_produccion`) o, si no
 * lo han tocado, la semilla del código. El acuerdo nunca se queda sin texto.
 */
export async function getAcuerdoProduccionTexto(): Promise<AcuerdoSeed> {
  try {
    const { data } = await supabaseAdmin()
      .from("plantillas")
      .select("titulo, cuerpo")
      .eq("tipo", ACUERDO_PRODUCCION_TIPO)
      .single();
    if (data?.cuerpo) {
      return { titulo: (data.titulo as string) || ACUERDO_PRODUCCION_SEED.titulo, cuerpo: data.cuerpo as string };
    }
  } catch {
    /* respaldo */
  }
  return ACUERDO_PRODUCCION_SEED;
}

/** Carga la cotización con lo que el acuerdo necesita. `null` si no existe o falta el SQL. */
export async function cargarCotAcuerdo(sb: SB, id: string): Promise<CotAcuerdo | null> {
  const { data, error } = await sb
    .from("cotizaciones")
    .select("id, folio, cliente_nombre, cliente_email, items, created_at, acuerdo_individual")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    folio: (data.folio as string) || "COT",
    cliente_nombre: (data.cliente_nombre as string | null) ?? null,
    cliente_email: (data.cliente_email as string | null) ?? null,
    items: Array.isArray(data.items) ? data.items : [],
    created_at: (data.created_at as string | null) ?? null,
    acuerdo_individual: !!data.acuerdo_individual,
  };
}

export const variablesDeCotizacion = (c: CotAcuerdo): VariablesProduccion => ({
  folio: c.folio,
  fecha_cotizacion: fechaLarga(c.created_at ? new Date(c.created_at) : new Date()),
  titulo: tituloDeProduccion(c.items, c.folio),
});

/** El texto que verá el cliente, con todo relleno menos `{{cliente}}`. */
export async function textoParaFirmar(c: CotAcuerdo): Promise<{ titulo: string; cuerpo: string; huecos: string[] }> {
  const t = await getAcuerdoProduccionTexto();
  const cuerpo = renderProduccion(t.cuerpo, variablesDeCotizacion(c));
  return { titulo: t.titulo, cuerpo, huecos: huecosSinResolver(cuerpo) };
}

/** Cuándo firmó el acuerdo de esta cotización, o `null` si no ha firmado. */
export async function firmaDeProduccion(sb: SB, cotizacionId: string): Promise<string | null> {
  const { data } = await sb
    .from("acuerdos_produccion")
    .select("aceptado_at")
    .eq("cotizacion_id", cotizacionId)
    .maybeSingle();
  return (data?.aceptado_at as string | undefined) ?? null;
}

/**
 * ¿El proyecto que va a nacer de esta cotización debe quedar esperando firma?
 *
 * Ante cualquier falla devuelve `false` (no bloquear): un error de lectura no
 * debe frenar la creación del proyecto de alguien que ya pagó. El interruptor
 * solo se puede encender con el SQL corrido, así que no hay caso donde esto
 * falle en silencio para una cotización individual.
 */
export async function proyectoNaceBloqueado(sb: SB, cotizacionId: string | null | undefined): Promise<boolean> {
  if (!cotizacionId) return false;
  try {
    const { data } = await sb.from("cotizaciones").select("acuerdo_individual").eq("id", cotizacionId).maybeSingle();
    if (!data?.acuerdo_individual) return false;
    return debeBloquearProduccion({ acuerdoIndividual: true, firmado: !!(await firmaDeProduccion(sb, cotizacionId)) });
  } catch {
    return false;
  }
}

/** Pone o quita "esperando firma" en los proyectos que ya salieron de esta cotización. */
export async function marcarProyectosDeCotizacion(sb: SB, cotizacionId: string, pendiente: boolean): Promise<number> {
  const { data, error } = await sb
    .from("proyectos")
    .update({ acuerdo_pendiente: pendiente })
    .eq("cotizacion_id", cotizacionId)
    .select("id");
  return error ? 0 : (data ?? []).length;
}

export type EnvioProduccion =
  | { ok: true; url: string }
  | { ok: false; status: number; error: string; yaFirmo?: boolean };

/**
 * Manda (o reenvía) el enlace de firma del acuerdo individual.
 *
 * Lo usan el envío de la cotización y el botón "recordar firma", para que los
 * dos manden EXACTAMENTE lo mismo. Va solo al correo del cliente: el enlace
 * lleva el correo dentro y quien lo abra firma COMO ese correo.
 *
 * Falla en voz alta (a diferencia del acuerdo por familia, que es best-effort):
 * aquí el enlace es lo que desbloquea la producción, y un envío que fallara en
 * silencio dejaría al cliente esperando algo que nunca le llegó.
 */
export async function mandarEnlaceProduccion(sb: SB, c: CotAcuerdo, actor: string | null): Promise<EnvioProduccion> {
  const to = (c.cliente_email || "").trim().toLowerCase();
  if (!to) return { ok: false, status: 409, error: "Esa cotización no tiene correo del cliente. Agrégaselo e inténtalo de nuevo." };

  if (await firmaDeProduccion(sb, c.id)) {
    return { ok: false, status: 409, yaFirmo: true, error: `${c.cliente_nombre || "El cliente"} ya firmó el acuerdo de esta producción.` };
  }

  const texto = await textoParaFirmar(c);
  if (texto.huecos.length) {
    return {
      ok: false, status: 422,
      error: `La plantilla del acuerdo de producción tiene campos sin reconocer (${texto.huecos.map((h) => `{{${h}}}`).join(", ")}). Corrígela en Cotizaciones → Plantillas.`,
    };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, status: 500, error: "Correo no configurado (RESEND_API_KEY)." };

  const url = await conseguirEnlaceProduccion(to, c.id, actor);
  if (!url) {
    return { ok: false, status: 500, error: "No se pudo generar el enlace de firma. ¿Falta correr supabase-acuerdo-produccion.sql?" };
  }

  const mail = firmaAcuerdoProduccionEmail({
    customerName: c.cliente_nombre?.split(" ")[0] ?? null,
    folio: c.folio,
    titulo: tituloDeProduccion(c.items, c.folio),
    url,
  });
  try {
    await new Resend(key).emails.send({ from: FROM, to: [to], subject: mail.subject, html: mail.html });
  } catch (e) {
    return { ok: false, status: 500, error: e instanceof Error ? e.message : "Falló el envío del enlace de firma." };
  }
  return { ok: true, url };
}
