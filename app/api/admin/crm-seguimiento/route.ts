import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

/**
 * Próxima acción de un contacto ("llamar", "mandar cotización" + fecha).
 *
 * Va en su PROPIA ruta y no en `/api/admin/contactos` a propósito: esa es
 * admin-only (edita nombre, correo, etapa y borra fichas). Programar un
 * seguimiento es el trabajo diario del CRM, así que aquí entra también el rol
 * `crm` — sin abrirle la edición sensible del contacto.
 */
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "crm")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del contacto." }, { status: 400 });

  const accion = b.proxima_accion ? String(b.proxima_accion).trim() : null;
  const fecha = b.proxima_fecha ? String(b.proxima_fecha).slice(0, 10) : null;

  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: prev } = await sb.from("contactos").select("nombre").eq("id", id).single();
  const { error } = await sb
    .from("contactos")
    .update({ proxima_accion: accion, proxima_fecha: fecha, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bitácora → campanita de Clientes. Sin esto el módulo tendría notificaciones
  // push pero su campanita saldría vacía, que era justo la queja.
  try {
    const quien = await nombreDeActor(sb, s.email);
    const nombre = (prev?.nombre as string | null) ?? "un contacto";
    await registrarActividad(sb, {
      tipo: accion ? "seguimiento_programado" : "seguimiento_cerrado",
      titulo: accion
        ? `${quien} programó “${accion}” con ${nombre}${fecha ? ` para el ${fecha}` : ""}`
        : `${quien} cerró el seguimiento de ${nombre}`,
      actor: s.email, entidad: "contacto", entidad_id: id, entidad_nombre: nombre,
      meta: { accion, fecha },
    });
  } catch { /* bitácora best-effort */ }

  // Queda en el historial: así se ve en la línea de tiempo quién programó qué.
  // Best-effort — si falla, el seguimiento ya quedó guardado.
  try {
    await sb.from("interacciones").insert({
      contacto_id: id,
      tipo: "seguimiento",
      resumen: accion ? `Próxima acción: ${accion}${fecha ? ` (${fecha})` : ""}` : "Seguimiento cerrado",
      ocurrio_at: new Date().toISOString(),
      metadata: { autor: s.email, accion, fecha },
    });
  } catch { /* historial best-effort */ }

  return NextResponse.json({ ok: true });
}
