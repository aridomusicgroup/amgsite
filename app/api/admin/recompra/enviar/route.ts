import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { datosRecompra, correoRecompra, marcarRecompra } from "@/lib/recompra-envio";
import { destinatariosDe } from "@/lib/destinatarios";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FROM = "Latino Gang Beats <pedidos@aridomusicgroup.com>";

/**
 * Manda el correo de recompra y, si sale, sella el ciclo en el mismo golpe.
 *
 * El orden importa: PRIMERO se manda y DESPUÉS se marca. Si se marcara antes y
 * fallara Resend, el cliente saldría de la bandeja sin que nadie le haya escrito
 * — se pierde callado. Al revés, lo peor que pasa es que el correo salga y la
 * marca falle: el cliente reaparece mañana y alguien lo ve.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "crm")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  const mensaje = String(b.mensaje || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del contacto." }, { status: 400 });
  if (!mensaje) return NextResponse.json({ error: "El mensaje está vacío." }, { status: 400 });

  const sb = supabaseAdmin();
  const d = await datosRecompra(sb, id);
  if (!d) return NextResponse.json({ error: "Ese contacto no tiene compras." }, { status: 400 });

  const { ok: destinatarios, malos } = destinatariosDe(d.email, b.emails);
  if (malos.length) {
    return NextResponse.json({ error: `Correo inválido: ${malos.join(", ")}` }, { status: 400 });
  }
  if (destinatarios.length === 0) {
    return NextResponse.json(
      { error: "Ese contacto no tiene correo. Agrégaselo en su ficha o escríbele por WhatsApp." },
      { status: 400 },
    );
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Correo no configurado (RESEND_API_KEY)." }, { status: 500 });

  const mail = correoRecompra(d, mensaje);
  try {
    const resend = new Resend(key);
    await resend.emails.send({
      from: FROM,
      to: destinatarios,
      subject: mail.subject,
      html: mail.html,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falló el envío." }, { status: 500 });
  }

  const err = await marcarRecompra(sb, {
    id,
    ancla: d.ancla,
    accion: "contactado",
    mensaje,
    autor: s.email,
    via: "correo",
    destinatarios,
  });
  // El correo YA salió: no se puede des-enviar. Se avisa que la marca falló para
  // que quien lo mandó sepa que el cliente va a reaparecer en la bandeja.
  if (err) {
    return NextResponse.json(
      { ok: true, destinatarios, aviso: "Se mandó el correo, pero no se pudo anotar en su ficha." },
      { status: 200 },
    );
  }

  try {
    const quien = await nombreDeActor(sb, s.email);
    await registrarActividad(sb, {
      tipo: "recompra_enviada",
      titulo: `${quien} mandó el correo de recompra a ${d.nombre ?? destinatarios[0]}`,
      actor: s.email,
      entidad: "contacto",
      entidad_id: id,
      entidad_nombre: d.nombre ?? null,
      meta: { destinatarios, concepto: d.perfil.ultimaCompraConcepto },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, destinatarios });
}
