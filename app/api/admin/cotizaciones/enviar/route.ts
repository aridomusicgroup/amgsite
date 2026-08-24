import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateQuotePdf, QuoteItem } from "@/lib/pdf/quote";
import { getCotizacionTerminos } from "@/lib/plantillas-data";
import { cotizacionEmail } from "@/lib/emails";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";
import { destinatariosDe } from "@/lib/destinatarios";
import { seguimientoAuto, DIAS_TRAS_COTIZACION } from "@/lib/seguimiento-auto";
import { familiaDeCotizacion, FAMILIA_LABEL } from "@/lib/acuerdos/familias";
import { ACUERDO_VERSIONES } from "@/lib/acuerdos/acuerdo-cliente";
import { conseguirEnlaceFirma } from "@/lib/acuerdos/invitaciones";
import { firmaAcuerdoEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM = "Latino Gang Beats <pedidos@aridomusicgroup.com>";

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "crm")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: c } = await sb.from("cotizaciones").select("*").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });

  const { ok: destinatarios, malos } = destinatariosDe((c.cliente_email as string | null) ?? null, b.emails);
  if (malos.length) {
    return NextResponse.json({ error: `Correo inválido: ${malos.join(", ")}` }, { status: 400 });
  }
  if (destinatarios.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un correo para enviar la cotización." }, { status: 400 });
  }
  // El PDF se emite a nombre del cliente; los demás son copias del mismo documento.
  const to = (c.cliente_email as string | null)?.trim() || destinatarios[0];

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Correo no configurado (RESEND_API_KEY)." }, { status: 500 });

  const moneda = (c.moneda as string) || "MXN";
  const terminos = await getCotizacionTerminos();
  const bytes = await generateQuotePdf({
    folio: (c.folio as string) || "COT",
    fecha: c.created_at ? new Date(c.created_at as string) : new Date(),
    vigenciaDias: Number(c.vigencia_dias) || 15,
    moneda,
    cliente: {
      nombre: (c.cliente_nombre as string | null) ?? null,
      email: to,
      telefono: (c.cliente_telefono as string | null) ?? null,
      direccion: (c.cliente_direccion as string | null) ?? null,
    },
    items: (Array.isArray(c.items) ? c.items : []) as QuoteItem[],
    descuento: Number(c.descuento) || 0,
    comisionPct: Number(c.comision_pct) || 0,
    notas: (c.notas as string | null) ?? null,
    terminos,
    esquemaPago: (c.esquema_pago as string | null) ?? null,
    numCanciones: c.num_canciones != null ? Number(c.num_canciones) : null,
    descuentoFidelidad: Number(c.descuento_fidelidad) || 0,
    creditoAplicado: Number(c.credito_aplicado) || 0,
  });

  const mail = cotizacionEmail({
    customerName: (c.cliente_nombre as string | null)?.split(" ")[0] ?? null,
    folio: (c.folio as string) || "COT",
    total: Number(c.total) || 0,
    moneda,
    vigenciaDias: Number(c.vigencia_dias) || 15,
  });

  try {
    const resend = new Resend(key);
    // Un solo envío con todos en "Para": quedan en el mismo hilo y pueden
    // responder a todos. Ojo: se ven los correos entre sí (es lo esperado
    // cuando se copia al manager o a quien paga).
    await resend.emails.send({
      from: FROM,
      to: destinatarios,
      subject: mail.subject,
      html: mail.html,
      attachments: [{ filename: `Cotizacion ${(c.folio as string) || ""}.pdf`.replace(/[\\/:*?"<>|]/g, ""), content: Buffer.from(bytes) }],
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falló el envío." }, { status: 500 });
  }

  // ── Acuerdo antes del anticipo ──────────────────────────────────────────
  // Solo para servicios a la medida (personalizado, servicio, exclusiva
  // negociada): el acuerdo protege de verdad si se firma ANTES de cobrar, no
  // al entrar al panel semanas después. Best-effort: si falla, la cotización
  // ya se mandó y el acuerdo se sigue pidiendo como red de seguridad al
  // entrar al panel (fase 4, ya en vivo).
  try {
    const familia = familiaDeCotizacion(c.tipo as string | null);
    if (familia && to) {
      const { data: yaFirmo } = await sb
        .from("cliente_acuerdos")
        .select("id")
        .eq("email", to.toLowerCase())
        .eq("familia", familia)
        .eq("version", ACUERDO_VERSIONES[familia])
        .maybeSingle();
      if (!yaFirmo) {
        const url = await conseguirEnlaceFirma(to, familia, id, s.email);
        if (url) {
          const mail = firmaAcuerdoEmail({
            customerName: (c.cliente_nombre as string | null)?.split(" ")[0] ?? null,
            familiaLabel: FAMILIA_LABEL[familia],
            folio: (c.folio as string) || "COT",
            url,
          });
          await new Resend(key).emails.send({ from: FROM, to: [to], subject: mail.subject, html: mail.html });
        }
      }
    }
  } catch (e) {
    console.error("firma-acuerdo:", e);
  }

  await sb.from("cotizaciones").update({ estado: "enviada", updated_at: new Date().toISOString() }).eq("id", id);

  // El reloj para perseguir la cotización arranca cuando SALE, no cuando se
  // captura: un borrador que todavía no mandas no hay por qué recordarlo.
  await seguimientoAuto(sb, {
    contactoId: (c.contacto_id as string | null) ?? null,
    accion: `Dar seguimiento a la cotización ${(c.folio as string) || ""}`.trim(),
    dias: DIAS_TRAS_COTIZACION,
    motivo: `se envió ${(c.folio as string) || "la cotización"}`,
    actor: s.email,
  });

  try {
    const quien = await nombreDeActor(sb, s.email);
    await registrarActividad(sb, {
      tipo: "cotizacion_enviada",
      titulo: `${quien} envió la cotización ${c.folio ?? ""} a ${destinatarios.join(", ")}`,
      actor: s.email, entidad: "cotizacion", entidad_id: id, entidad_nombre: (c.folio as string) ?? null,
      meta: { total: c.total ?? null, destinatarios },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, destinatarios });
}
