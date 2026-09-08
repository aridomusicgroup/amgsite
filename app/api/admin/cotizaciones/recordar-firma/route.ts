import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { firmaAcuerdoEmail } from "@/lib/emails";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";
import { familiaDeCotizacion, FAMILIA_LABEL } from "@/lib/acuerdos/familias";
import { ACUERDO_VERSIONES } from "@/lib/acuerdos/acuerdo-cliente";
import { conseguirEnlaceFirma } from "@/lib/acuerdos/invitaciones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM = "Latino Gang Beats <pedidos@aridomusicgroup.com>";

/**
 * Volver a pedirle al cliente que firme el acuerdo de su cotización.
 *
 * El enlace de firma sale hoy pegado al envío de la cotización, una sola vez.
 * Si el cliente no lo abrió —o el correo se perdió, o pidió el enlace por
 * WhatsApp— no había forma de reenviárselo sin volver a mandarle la cotización
 * entera, con su PDF y su "aquí está tu cotización", que a esas alturas ya no
 * es lo que hace falta.
 *
 * Medido antes de escribir esto: de 58 cotizaciones, 20 tienen el acuerdo
 * firmado, 12 tienen enlace vivo sin firmar, y **3 nunca recibieron el enlace**
 * —una de ellas ya aceptada por el cliente.
 *
 * Manda EXACTAMENTE el mismo correo que el envío de la cotización
 * (`firmaAcuerdoEmail`) y reusa el mismo enlace vivo si lo hay
 * (`conseguirEnlaceFirma`): mandarle dos links distintos para lo mismo confunde
 * más de lo que ayuda.
 *
 * Va SÓLO al correo del cliente, sin copias. El token lleva el correo dentro y
 * quien lo abra firma COMO ese correo — copiar a un tercero sería darle a otra
 * persona la posibilidad de firmar a nombre del cliente.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "crm")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta la cotización." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: c } = await sb
    .from("cotizaciones")
    .select("id, folio, tipo, cliente_email, cliente_nombre")
    .eq("id", id)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "Esa cotización ya no existe." }, { status: 404 });

  const familia = familiaDeCotizacion(c.tipo as string | null);
  if (!familia) {
    return NextResponse.json(
      { error: "Ese tipo de servicio no tiene acuerdo que firmar." },
      { status: 400 },
    );
  }

  const to = String(c.cliente_email || "").trim().toLowerCase();
  if (!to) {
    return NextResponse.json(
      { error: "Esa cotización no tiene correo del cliente. Agrégaselo y vuelve a intentar." },
      { status: 409 },
    );
  }

  // Si ya firmó, no se le manda nada. Un recordatorio de algo hecho es la clase
  // de correo que enseña a la gente a ignorar los nuestros.
  const { data: yaFirmo } = await sb
    .from("cliente_acuerdos")
    .select("aceptado_at")
    .eq("email", to)
    .eq("familia", familia)
    .eq("version", ACUERDO_VERSIONES[familia])
    .maybeSingle();
  if (yaFirmo) {
    return NextResponse.json(
      { error: `${c.cliente_nombre || "El cliente"} ya firmó este acuerdo.`, firmadoEn: yaFirmo.aceptado_at },
      { status: 409 },
    );
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Correo no configurado (RESEND_API_KEY)." }, { status: 500 });

  const url = await conseguirEnlaceFirma(to, familia, id, s.email);
  if (!url) return NextResponse.json({ error: "No se pudo generar el enlace de firma." }, { status: 500 });

  const mail = firmaAcuerdoEmail({
    customerName: (c.cliente_nombre as string | null)?.split(" ")[0] ?? null,
    familiaLabel: FAMILIA_LABEL[familia],
    folio: (c.folio as string) || "COT",
    url,
  });

  try {
    await new Resend(key).emails.send({ from: FROM, to: [to], subject: mail.subject, html: mail.html });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falló el envío." },
      { status: 500 },
    );
  }

  // La bitácora es lo que hace que el panel pueda decir "ya se le recordó hace
  // 2 días" — no hay columna para eso, y este renglón es la fuente.
  try {
    const quien = await nombreDeActor(sb, s.email);
    await registrarActividad(sb, {
      tipo: "acuerdo_recordado",
      titulo: `${quien} le recordó a ${c.cliente_nombre || to} firmar el acuerdo de ${(c.folio as string) || ""}`.trim(),
      actor: s.email,
      entidad: "cotizacion",
      entidad_id: id,
      entidad_nombre: (c.folio as string) ?? null,
      meta: { email: to, familia },
    });
  } catch { /* bitácora best-effort: el correo ya salió */ }

  return NextResponse.json({ ok: true, enviado: to });
}
