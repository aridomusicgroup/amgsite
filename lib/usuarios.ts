import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Control de acceso al panel desde la tabla `usuarios` (fuente de verdad).
 * El login lo consulta con respaldo a las variables de entorno (migración).
 */

export type Rol = "admin" | "crm" | "produccion";
export interface UsuarioAcceso { rol: Rol; activo: boolean }
export interface UsuarioRow { email: string; rol: Rol; activo: boolean; nombre: string | null }

const parseEnv = (v?: string) => (v ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const ROLES: Rol[] = ["admin", "crm", "produccion"];
export const esRol = (r: unknown): r is Rol => typeof r === "string" && (ROLES as string[]).includes(r);

/** Acceso de un correo (cacheado por request para no repetir la consulta). */
export const getUsuarioAcceso = cache(async (email: string): Promise<UsuarioAcceso | null> => {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.from("usuarios").select("rol, activo").eq("email", email.toLowerCase()).maybeSingle();
    if (!data) return null;
    return { rol: (data.rol as Rol) ?? "produccion", activo: Boolean(data.activo) };
  } catch {
    return null;
  }
});

/** Inserta un usuario si no existe (no pisa rol/activo si ya está). */
export async function ensureUsuario(email: string, rol: Rol): Promise<void> {
  try {
    await supabaseAdmin().from("usuarios").upsert(
      { email: email.toLowerCase(), rol, activo: true },
      { onConflict: "email", ignoreDuplicates: true },
    );
  } catch { /* noop */ }
}

/** Siembra los usuarios de las variables de entorno (idempotente, no pisa). */
export async function seedUsuariosFromEnv(): Promise<void> {
  const grupos: [string[], Rol][] = [
    [parseEnv(process.env.ADMIN_EMAILS), "admin"],
    [parseEnv(process.env.CRM_EMAILS), "crm"],
    [parseEnv(process.env.PRODUCCION_EMAILS), "produccion"],
  ];
  const seen = new Set<string>();
  const rows: { email: string; rol: Rol; activo: boolean }[] = [];
  for (const [emails, rol] of grupos) for (const e of emails) if (!seen.has(e)) { seen.add(e); rows.push({ email: e, rol, activo: true }); }
  if (!rows.length) return;
  try {
    await supabaseAdmin().from("usuarios").upsert(rows, { onConflict: "email", ignoreDuplicates: true });
  } catch { /* noop */ }
}

/** Lista todos los usuarios del panel. */
export async function listUsuarios(): Promise<UsuarioRow[]> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.from("usuarios").select("email, rol, activo, nombre").order("rol").order("email");
    return (data ?? []).map((r) => ({
      email: r.email as string,
      rol: (r.rol as Rol) ?? "produccion",
      activo: Boolean(r.activo),
      nombre: (r.nombre as string | null) ?? null,
    }));
  } catch {
    return [];
  }
}

/** Cuántos admins activos hay (para no dejar el panel sin dueño). */
export async function contarAdminsActivos(): Promise<number> {
  try {
    const sb = supabaseAdmin();
    const { count } = await sb.from("usuarios").select("email", { count: "exact", head: true }).eq("rol", "admin").eq("activo", true);
    return count ?? 0;
  } catch {
    return 0;
  }
}
