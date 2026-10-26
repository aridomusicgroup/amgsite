import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { limpiarEmail, esEmail } from "@/lib/usuarios";
import { enviarInvitacion } from "@/lib/invitacion";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

/** Reenvía el correo de acceso a un usuario ya dado de alta ({ email }). Solo admin. */
export async function POST(req: NextRequest) {
  const yo = await getFullAdminEmail();
  if (!yo) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const email = limpiarEmail(b.email);
  if (!esEmail(email)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: u } = await sb.from("usuarios").select("email, rol, nombre, activo").eq("email", email).maybeSingle();
  if (!u) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  // Un usuario inactivo no puede entrar al panel: mandarle el enlace sería inútil y confuso.
  if (!u.activo) return NextResponse.json({ error: "Está inactivo: actívalo antes de mandarle el acceso." }, { status: 400 });

  const r = await enviarInvitacion(sb, { email, nombre: (u.nombre as string | null) ?? null, rol: String(u.rol) });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });

  try {
    const quien = await nombreDeActor(sb, yo);
    await registrarActividad(sb, {
      tipo: "usuario_invitado",
      titulo: `${quien} reenvió el acceso al panel a ${email}`,
      actor: yo, entidad: "usuario", entidad_id: email, entidad_nombre: email,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}
