import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

const ETAPAS = ["lead", "negociacion", "cliente", "recurrente", "perdido", "inactivo"];

// ── Editar un contacto (solo admin total) ──
export async function PATCH(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del contacto." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ("nombre" in b) patch.nombre = b.nombre ? String(b.nombre).trim() : null;
  if ("telefono" in b) patch.telefono = b.telefono ? String(b.telefono).trim() : null;
  if ("email" in b) patch.email = b.email ? String(b.email).trim().toLowerCase() : null;
  if ("direccion" in b) patch.direccion = b.direccion ? String(b.direccion).trim() : null;
  if ("origen" in b) patch.origen = b.origen ? b.origen : null;
  if ("servicio_interes" in b) patch.servicio_interes = b.servicio_interes ? b.servicio_interes : null;
  if ("etapa" in b && ETAPAS.includes(b.etapa)) patch.etapa = b.etapa;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const sb = supabaseAdmin();
  const { data: upd, error } = await sb.from("contactos").update(patch).eq("id", id).select("nombre, email").single();
  if (!error) {
    try {
      const quien = await nombreDeActor(sb, actor);
      const nombre = (upd?.nombre as string) || (upd?.email as string) || "contacto";
      await registrarActividad(sb, {
        tipo: "contacto_editado",
        titulo: `${quien} editó el contacto ${nombre} (${Object.keys(patch).join(", ")})`,
        actor, entidad: "contacto", entidad_id: id, entidad_nombre: nombre,
        meta: patch,
      });
    } catch { /* bitácora best-effort */ }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Eliminar un contacto (solo admin total) ──
// Conserva las ventas (solo las desvincula), des-fusiona las fichas hijas y deja
// que identidades/interacciones se borren por cascade.
export async function DELETE(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del contacto." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: c } = await sb.from("contactos").select("id, nombre, email").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "Contacto no encontrado." }, { status: 404 });

  await sb.from("ventas").update({ contacto_id: null }).eq("contacto_id", id);      // no perder ventas
  await sb.from("contactos").update({ merged_into: null }).eq("merged_into", id);    // liberar hijas
  const { error } = await sb.from("contactos").delete().eq("id", id);                // identidades+interacciones cascade
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    const nombre = (c.nombre as string) || (c.email as string) || "contacto";
    await registrarActividad(sb, {
      tipo: "contacto_eliminado",
      titulo: `${quien} eliminó el contacto ${nombre}`,
      actor, entidad: "contacto", entidad_id: id, entidad_nombre: nombre,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}
