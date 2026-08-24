import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DOMAINS } from "@/lib/site";
import type { Familia } from "./familias";

/** Cuánto dura vivo un enlace de firma antes de que haya que generar otro. */
const DIAS_VIGENCIA = 60;

export interface Invitacion {
  id: string;
  token: string;
  email: string;
  familia: Familia;
  cotizacion_id: string | null;
  expira_at: string;
  usado_at: string | null;
}

/**
 * Consigue un enlace de firma para (correo, familia): reusa uno vivo y sin
 * firmar si ya existe, o crea uno nuevo.
 *
 * Reusar evita que cada reenvío de la cotización invalide el enlace que el
 * cliente ya tiene abierto en su correo — mandarle dos links distintos para
 * lo mismo confunde más de lo que ayuda.
 */
export async function conseguirEnlaceFirma(
  email: string,
  familia: Familia,
  cotizacionId: string | null,
  creadoPor: string | null,
): Promise<string | null> {
  const sb = supabaseAdmin();
  const correo = email.toLowerCase();

  try {
    const { data: vivo } = await sb
      .from("acuerdo_invitaciones")
      .select("token")
      .eq("email", correo)
      .eq("familia", familia)
      .is("usado_at", null)
      .gt("expira_at", new Date().toISOString())
      .order("creado_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (vivo?.token) return `${DOMAINS.main}/firmar/${vivo.token}`;

    const token = crypto.randomBytes(24).toString("base64url");
    const expira = new Date();
    expira.setDate(expira.getDate() + DIAS_VIGENCIA);

    const { error } = await sb.from("acuerdo_invitaciones").insert({
      token,
      email: correo,
      familia,
      cotizacion_id: cotizacionId,
      creado_por: creadoPor,
      expira_at: expira.toISOString(),
    });
    if (error) return null; // tabla aún no creada u otro problema: no bloquear el envío de la cotización
    return `${DOMAINS.main}/firmar/${token}`;
  } catch {
    return null;
  }
}

/** El estado de un token, para la página pública. */
export type EstadoInvitacion =
  | { estado: "valida"; inv: Invitacion }
  | { estado: "usada" }
  | { estado: "vencida" }
  | { estado: "no_existe" };

export async function resolverInvitacion(token: string): Promise<EstadoInvitacion> {
  if (!token) return { estado: "no_existe" };
  try {
    const { data } = await supabaseAdmin()
      .from("acuerdo_invitaciones")
      .select("id, token, email, familia, cotizacion_id, expira_at, usado_at")
      .eq("token", token)
      .maybeSingle();
    if (!data) return { estado: "no_existe" };
    if (data.usado_at) return { estado: "usada" };
    if (new Date(data.expira_at as string) < new Date()) return { estado: "vencida" };
    return { estado: "valida", inv: data as Invitacion };
  } catch {
    return { estado: "no_existe" };
  }
}

/** Sella el token como usado. Se llama DESPUÉS de guardar la aceptación. */
export async function sellarInvitacion(id: string): Promise<void> {
  try {
    await supabaseAdmin().from("acuerdo_invitaciones").update({ usado_at: new Date().toISOString() }).eq("id", id);
  } catch {
    /* si esto falla el token queda reusable una vez más — no es grave */
  }
}
