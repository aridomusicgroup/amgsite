import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { chatBackend } from "@/lib/chat-backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Seguimientos sugeridos por la IA del chatbot: borradores para reactivar leads
 * que escribieron y no cerraron. Viven en MongoDB (backend en Railway); esta
 * ruta es el puente para poder aprobarlos desde el panel.
 *
 * NADA se envía solo: cada mensaje lo aprueba una persona, uno por uno.
 */

const ok = (s: { role: string } | null) => !!s && (s.role === "admin" || s.role === "crm");

export interface Seguimiento {
  _id: string;
  userId: string;
  channel: "instagram" | "whatsapp" | "messenger";
  touch: number;
  draft: string;
  edited?: string;
  finalText?: string;
  status: "pendiente" | "aprobado" | "enviado" | "omitido";
  createdAt: string;
  conversation?: { name?: string; username?: string; lastContact?: string; interest?: string | null } | null;
}

export async function GET() {
  const s = await getSession();
  if (!ok(s)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // OJO: el backend responde { followups, count } — NO un array pelón. Leerlo
  // como array devuelve [] y el panel sale vacío sin ningún error visible.
  const r = await chatBackend<{ followups?: Seguimiento[]; error?: string }>(
    "/api/admin/followups?status=pendiente",
  );
  if (!r.ok) {
    return NextResponse.json(
      { error: r.data?.error || "No se pudieron cargar los seguimientos." },
      { status: r.status },
    );
  }
  return NextResponse.json({ seguimientos: r.data?.followups ?? [] });
}

/** Editar el texto o cambiar el estado (omitir / reactivar). */
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!ok(s)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const cuerpo: Record<string, unknown> = {};
  if (typeof b.edited === "string") cuerpo.edited = b.edited;
  if (b.status && ["pendiente", "omitido", "aprobado"].includes(b.status)) cuerpo.status = b.status;
  if (!Object.keys(cuerpo).length) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  const r = await chatBackend(`/api/admin/followups/${id}`, { method: "PATCH", body: cuerpo });
  if (!r.ok) {
    const msg = (r.data as { error?: string })?.error || "No se pudo actualizar.";
    return NextResponse.json({ error: msg }, { status: r.status });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Envía el mensaje. `accion`:
 *  - "enviar"  → intenta el envío automático por la API de Meta.
 *  - "manual"  → lo marca como enviado porque la persona lo mandó a mano.
 *
 * Meta bloquea el envío automático pasadas 24 h del último mensaje del cliente
 * (requiere la función "Human Agent" aprobada). En ese caso el backend responde
 * 409 con `manual: true` → el panel ofrece copiar el texto y mandarlo a mano.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!ok(s)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  const accion = String(b.accion || "enviar");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const ruta = accion === "manual" ? `/api/admin/followups/${id}/manual-sent` : `/api/admin/followups/${id}/send`;
  const cuerpo = typeof b.edited === "string" ? { edited: b.edited } : {};

  const r = await chatBackend<{ error?: string; manual?: boolean; waUrl?: string }>(ruta, {
    method: "POST",
    body: cuerpo,
  });

  if (!r.ok) {
    return NextResponse.json(
      { error: r.data?.error || "No se pudo enviar.", manual: !!r.data?.manual },
      { status: r.status },
    );
  }
  return NextResponse.json({ ok: true, waUrl: r.data?.waUrl ?? null });
}
