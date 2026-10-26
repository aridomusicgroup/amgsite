import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esRol, contarAdminsActivos, limpiarEmail, esEmail } from "@/lib/usuarios";
import { enviarInvitacion } from "@/lib/invitacion";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

/**
 * Agrega o actualiza un usuario ({ email, rol, nombre? }). Solo admin.
 * Si el correo es nuevo, le manda su enlace de acceso; si el correo no sale, el
 * alta se queda (el admin lo reenvía con /api/admin/usuarios/invitar).
 */
export async function POST(req: NextRequest) {
  const yo = await getFullAdminEmail();
  if (!yo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const email = limpiarEmail(b.email);
  const rol = b.rol;
  if (!esEmail(email)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  if (!esRol(rol)) return NextResponse.json({ error: "Rol inválido." }, { status: 400 });

  const sb = supabaseAdmin();
  const nombre = b.nombre ? String(b.nombre).trim() : null;
  // Sólo a quien todavía no estaba se le escribe: volver a "agregar" a alguien
  // que ya tiene acceso no debe llenarle el correo de invitaciones.
  const { data: previo } = await sb.from("usuarios").select("email").eq("email", email).maybeSingle();

  const { error } = await sb.from("usuarios").upsert(
    { email, rol, nombre, activo: true, updated_at: new Date().toISOString() },
    { onConflict: "email" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let invitacion: "enviada" | "fallida" | "no_aplica" = "no_aplica";
  let invitacionError: string | undefined;
  if (!previo) {
    const r = await enviarInvitacion(sb, { email, nombre, rol });
    invitacion = r.ok ? "enviada" : "fallida";
    if (!r.ok) invitacionError = r.error;
  }

  try {
    const quien = await nombreDeActor(sb, yo);
    await registrarActividad(sb, {
      tipo: "usuario_agregado",
      titulo: `${quien} dio de alta a ${email} como ${rol}`,
      actor: yo, entidad: "usuario", entidad_id: email, entidad_nombre: email,
      meta: { rol, invitacion },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, invitacion, ...(invitacionError ? { invitacion_error: invitacionError } : {}) });
}

/** Cambia rol y/o activo de un usuario. Solo admin. Con candados anti-bloqueo. */
export async function PATCH(req: NextRequest) {
  const yo = await getFullAdminEmail();
  if (!yo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const email = limpiarEmail(b.email);
  if (!esEmail(email)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: actual } = await sb.from("usuarios").select("rol, activo").eq("email", email).maybeSingle();
  if (!actual) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("rol" in b) { if (!esRol(b.rol)) return NextResponse.json({ error: "Rol inválido." }, { status: 400 }); patch.rol = b.rol; }
  if ("activo" in b) patch.activo = Boolean(b.activo);

  const desactiva = patch.activo === false && actual.activo;
  const degrada = "rol" in patch && actual.rol === "admin" && patch.rol !== "admin";

  // No te quites a ti mismo el acceso de admin (evita auto-bloqueo).
  if (email === yo && (desactiva || degrada)) {
    return NextResponse.json({ error: "No puedes quitarte tu propio acceso de admin." }, { status: 400 });
  }
  // Debe quedar al menos un admin activo.
  if (actual.rol === "admin" && actual.activo && (desactiva || degrada) && (await contarAdminsActivos()) <= 1) {
    return NextResponse.json({ error: "Debe quedar al menos un admin activo." }, { status: 400 });
  }

  const { error } = await sb.from("usuarios").update(patch).eq("email", email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, yo);
    const que = "rol" in patch ? `rol → ${patch.rol}` : `${patch.activo ? "activado" : "desactivado"}`;
    await registrarActividad(sb, {
      tipo: "usuario_editado",
      titulo: `${quien} cambió el acceso de ${email} (${que})`,
      actor: yo, entidad: "usuario", entidad_id: email, entidad_nombre: email,
      meta: patch,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}

/** Elimina un usuario (?email=). Solo admin. No a ti mismo ni al último admin. */
export async function DELETE(req: NextRequest) {
  const yo = await getFullAdminEmail();
  if (!yo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const email = limpiarEmail(new URL(req.url).searchParams.get("email"));
  if (!email) return NextResponse.json({ error: "Falta el correo." }, { status: 400 });
  if (email === yo) return NextResponse.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: actual } = await sb.from("usuarios").select("rol, activo").eq("email", email).maybeSingle();
  if (actual?.rol === "admin" && actual.activo && (await contarAdminsActivos()) <= 1) {
    return NextResponse.json({ error: "Debe quedar al menos un admin activo." }, { status: 400 });
  }

  const { error } = await sb.from("usuarios").delete().eq("email", email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, yo);
    await registrarActividad(sb, {
      tipo: "usuario_eliminado",
      titulo: `${quien} quitó el acceso de ${email}`,
      actor: yo, entidad: "usuario", entidad_id: email, entidad_nombre: email,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}
