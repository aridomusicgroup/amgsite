import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateContractPdf, CONTRACT_LABELS, ContractTipo } from "@/lib/pdf/contracts";
import { QuoteItem } from "@/lib/pdf/quote";
import { contratoEmail } from "@/lib/emails";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";
import { destinatariosDe } from "@/lib/destinatarios";

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
  const { data: c } = await sb.from("contratos").select("*").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });

  const { ok: destinatarios, malos } = destinatariosDe((c.cliente_email as string | null) ?? null, b.emails);
  if (malos.length) {
    return NextResponse.json({ error: `Correo inválido: ${malos.join(", ")}` }, { status: 400 });
  }
  if (destinatarios.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un correo para enviar el contrato." }, { status: 400 });
  }
  // El contrato se emite a nombre del cliente; los demás reciben copia del mismo PDF.
  const to = (c.cliente_email as string | null)?.trim() || destinatarios[0];

  // Dirección obligatoria para enviar (la necesita el contrato). Si el contrato no
  // la tiene, se intenta heredar del contacto; si tampoco, se bloquea el envío.
  let direccion = (c.cliente_direccion as string | null)?.trim() || "";
  if (!direccion && c.contacto_id) {
    const { data: ct } = await sb.from("contactos").select("direccion").eq("id", c.contacto_id).single();
    direccion = (ct?.direccion as string | null)?.trim() || "";
    if (direccion) await sb.from("contratos").update({ cliente_direccion: direccion }).eq("id", id);
  }
  if (!direccion) {
    return NextResponse.json({ error: "Falta la dirección del cliente. Agrégala en el contrato o en su ficha del CRM antes de enviarlo." }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Correo no configurado (RESEND_API_KEY)." }, { status: 500 });

  const tipo = ((c.tipo as string) || "generico") as ContractTipo;
  const bytes = await generateContractPdf(tipo, {
    folio: (c.folio as string) || "CONT",
    fecha: c.created_at ? new Date(c.created_at as string) : new Date(),
    moneda: (c.moneda as string) || "MXN",
    monto: Number(c.monto) || 0,
    concepto: (c.concepto as string | null) ?? undefined,
    cliente: {
      nombre: (c.cliente_nombre as string | null) ?? null,
      email: to,
      telefono: (c.cliente_telefono as string | null) ?? null,
      direccion,
    },
    items: (Array.isArray(c.items) ? c.items : []) as QuoteItem[],
    clausulasExtra: (c.clausulas_extra as string | null) ?? null,
  });

  const mail = contratoEmail({
    customerName: (c.cliente_nombre as string | null)?.split(" ")[0] ?? null,
    tipoLabel: CONTRACT_LABELS[tipo] ?? "Contrato",
    concepto: (c.concepto as string | null) ?? null,
  });

  try {
    const resend = new Resend(key);
    // Un solo envío con todos en "Para": quedan en el mismo hilo y pueden
    // responder a todos. Se ven los correos entre sí (esperado al copiar
    // al manager o a quien firma).
    await resend.emails.send({
      from: FROM,
      to: destinatarios,
      subject: mail.subject,
      html: mail.html,
      attachments: [{ filename: `Contrato ${(c.folio as string) || ""}.pdf`.replace(/[\\/:*?"<>|]/g, ""), content: Buffer.from(bytes) }],
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falló el envío." }, { status: 500 });
  }

  await sb.from("contratos").update({ estado: "enviado", updated_at: new Date().toISOString() }).eq("id", id);

  try {
    const quien = await nombreDeActor(sb, s.email);
    await registrarActividad(sb, {
      tipo: "contrato_enviado",
      titulo: `${quien} envió el contrato ${c.folio ?? ""} a ${destinatarios.join(", ")}`,
      actor: s.email, entidad: "contrato", entidad_id: id, entidad_nombre: (c.folio as string) ?? null,
      meta: { destinatarios },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, destinatarios });
}
