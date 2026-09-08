import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";
import { deudores, mandarToque, correoDeToque, type Deudor } from "@/lib/cobranza";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function staff(): Promise<string | null> {
  const s = await getSession();
  return s && (s.role === "admin" || s.role === "crm") ? s.email : null;
}

/** La cola de cobranza: quién debe, qué toque le toca y si ya se puede mandar. */
export async function GET() {
  if (!(await staff())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ deudores: await deudores(supabaseAdmin()) });
}

/**
 * La PREVIA del correo, sin mandar nada.
 *
 * Va aparte del envío a propósito: nadie debería apretar "mandar" sin haber
 * leído lo que le va a llegar al cliente. Es el mismo patrón de la bandeja de
 * recompra, que ya resolvió esto.
 *
 * No genera el link de Stripe —eso crearía una sesión de pago por cada vez que
 * alguien echa un ojo—: en la previa el botón sale con un `#`.
 */
export async function PUT(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const ventaId = String(b.ventaId || "").trim();
  const toque = Number(b.toque);
  if (!ventaId || ![1, 2, 3].includes(toque)) {
    return NextResponse.json({ error: "Falta la venta o el toque." }, { status: 400 });
  }

  const lista = await deudores(supabaseAdmin());
  const d = lista.find((x) => x.ventaId === ventaId);
  if (!d) return NextResponse.json({ error: "Esa venta ya no tiene saldo." }, { status: 404 });

  const mail = correoDeToque(toque as 1 | 2 | 3, d, "#");
  return NextResponse.json({ ok: true, subject: mail.subject, html: mail.html, deudor: d });
}

/**
 * Manda el toque. Un cliente, un correo, con tu visto bueno.
 *
 * Sin envío en bloque a propósito, igual que la bandeja de recompra y los
 * seguimientos del chatbot: la disciplina de este panel es que nada sale sin
 * que una persona lo haya visto. Un cobro automático mal cronometrado a un
 * cliente recurrente cuesta la relación, y 6 de los 10 que deben hoy lo son.
 */
export async function POST(req: NextRequest) {
  const actor = await staff();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const ventaId = String(b.ventaId || "").trim();
  const toque = Number(b.toque);
  if (!ventaId || ![1, 2, 3].includes(toque)) {
    return NextResponse.json({ error: "Falta la venta o el toque." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const lista = await deudores(sb);
  const d = lista.find((x) => x.ventaId === ventaId);
  if (!d) return NextResponse.json({ error: "Esa venta ya no tiene saldo." }, { status: 404 });

  const r = await mandarToque(sb, d, toque as 1 | 2 | 3, actor);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "cobranza_enviada",
      titulo: `${quien} le mandó el toque ${toque} de cobranza a ${d.nombre || r.email} por ${d.folio}`,
      actor,
      entidad: "venta", entidad_id: d.ventaId, entidad_nombre: d.folio,
      meta: { toque, saldo: d.saldo, email: r.email, cerrado: toque === 3 },
    });
  } catch { /* bitácora best-effort: el correo ya salió */ }

  return NextResponse.json({ ok: true, email: r.email, cerrado: toque === 3 });
}

/**
 * Prender o apagar «no contactar» de un cliente.
 *
 * Es la única cosa que hace segura cualquier automatización, y hasta ahora no
 * existía: sin esto le seguiríamos escribiendo a quien ya nos bloqueó en
 * WhatsApp e Instagram. Excluye de cobranza, de recompra y del recordatorio
 * diario.
 */
export async function PATCH(req: NextRequest) {
  const actor = await staff();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const contactoId = String(b.contactoId || "").trim();
  if (!contactoId) return NextResponse.json({ error: "Falta el contacto." }, { status: 400 });
  const prender = b.noContactar === true;
  const motivo = String(b.motivo || "").trim().slice(0, 300) || null;

  const sb = supabaseAdmin();
  const { data: c } = await sb.from("contactos").select("nombre, email").eq("id", contactoId).maybeSingle();
  if (!c) return NextResponse.json({ error: "Ese contacto ya no existe." }, { status: 404 });

  const { error } = await sb.from("contactos").update({
    no_contactar: prender,
    no_contactar_motivo: prender ? motivo : null,
    no_contactar_at: prender ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", contactoId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    const nombre = (c.nombre as string) || (c.email as string) || "un contacto";
    await registrarActividad(sb, {
      tipo: "contacto_editado",
      titulo: prender
        ? `${quien} marcó a ${nombre} como «no contactar»${motivo ? ` — ${motivo}` : ""}`
        : `${quien} le quitó a ${nombre} la marca de «no contactar»`,
      actor, entidad: "contacto", entidad_id: contactoId, entidad_nombre: nombre,
      meta: { no_contactar: prender, motivo },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, noContactar: prender });
}

export type { Deudor };
