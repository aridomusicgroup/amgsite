import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { effectiveModules } from "@/lib/modules";
import { getUsuarioAcceso, ensureUsuario } from "@/lib/usuarios";

const parse = (v: string | undefined) =>
  (v ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

/** Admins totales (env ADMIN_EMAILS). Acceso a todo el panel. */
export function adminEmails(): string[] {
  return parse(process.env.ADMIN_EMAILS);
}

/** Rol limitado (env CRM_EMAILS): Marketing, Pedidos, Beats, Clientes, Importar, Producción. Sin Ventas ni Finanzas. */
export function crmEmails(): string[] {
  return parse(process.env.CRM_EMAILS);
}

/** Rol producción (env PRODUCCION_EMAILS): SOLO el panel de Producción, nada más. */
export function produccionEmails(): string[] {
  return parse(process.env.PRODUCCION_EMAILS);
}

export type Role = "admin" | "crm" | "produccion";
export interface AdminSession {
  email: string;
  role: Role;
}

/** Cliente Supabase ligado a las cookies de la petición (lee la sesión del usuario). */
export async function createServerAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* llamado desde un Server Component: ignorar */
          }
        },
      },
    }
  );
}

/**
 * Sesión del usuario autenticado con su rol, o null si no hay sesión o el correo
 * no está autorizado. 'admin' = lista ADMIN_EMAILS; 'crm' = lista CRM_EMAILS.
 * Si ninguna lista está configurada, se permite como admin (fallback de arranque).
 */
export async function getSession(): Promise<AdminSession | null> {
  try {
    const supabase = await createServerAuthClient();
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email?.toLowerCase();
    if (!email) return null;

    // 1) Fuente de verdad: tabla `usuarios` (gestionable desde el panel).
    const acc = await getUsuarioAcceso(email);
    if (acc) return acc.activo ? { email, role: acc.rol } : null;

    // 2) Respaldo (migración): variables de entorno. Autoriza y siembra en la
    //    tabla para que a partir de ahora se gestione desde el panel.
    const admins = adminEmails();
    const crm = crmEmails();
    const prod = produccionEmails();
    let role: Role | null =
      admins.includes(email) ? "admin" : crm.includes(email) ? "crm" : prod.includes(email) ? "produccion" : null;
    // Arranque: SOLO si no hay ninguna lista configurada Y el correo coincide con
    // un BOOTSTRAP_ADMIN explícito. Antes, sin envs, cualquier usuario autenticado
    // se volvía admin — ante un fallo de config eso concedía acceso total. Ahora la
    // ausencia de configuración NIEGA el acceso salvo este opt-in de un solo correo.
    if (!role && admins.length === 0 && crm.length === 0 && prod.length === 0) {
      const bootstrap = (process.env.BOOTSTRAP_ADMIN ?? "").trim().toLowerCase();
      if (bootstrap && bootstrap === email) role = "admin";
    }
    if (role) { await ensureUsuario(email, role); return { email, role }; }
    return null;
  } catch {
    return null;
  }
}

/**
 * Correo del usuario autorizado (cualquier rol), o null. Lo usan las páginas/APIs
 * accesibles para todo el equipo (CRM, beats, importar, pedidos).
 */
export async function getAdminEmail(): Promise<string | null> {
  const s = await getSession();
  return s ? s.email : null;
}

/** Correo SOLO si es admin total. Lo usan Ventas, Finanzas, nómina y egresos. */
export async function getFullAdminEmail(): Promise<string | null> {
  const s = await getSession();
  return s && s.role === "admin" ? s.email : null;
}

/** Correo si puede usar el panel de Producción (admin, crm o produccion). */
export async function getProduccionEmail(): Promise<string | null> {
  const s = await getSession();
  return s && (s.role === "admin" || s.role === "crm" || s.role === "produccion") ? s.email : null;
}

/**
 * Para páginas de "oficina" (Marketing, Pedidos, Beats, Clientes, Importar):
 * exige sesión admin|crm. El rol 'produccion' se manda a su panel; sin sesión, al login.
 */
export async function requireStaff(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (s.role === "produccion") redirect("/admin/produccion");
  return s;
}

// ── Preferencias y módulos por usuario ──────────────────────────────────────
export interface UserPrefs {
  font_size: string; theme: string;
  module_order: string[] | null; modules_extra: string[] | null;
}

/** Lee las preferencias de un usuario (o null si no existen / tabla ausente). */
export async function getUserPrefs(email: string): Promise<UserPrefs | null> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("user_prefs")
      .select("font_size, theme, module_order, modules_extra")
      .eq("email", email.toLowerCase())
      .limit(1);
    const row = data?.[0];
    if (!row) return null;
    return {
      font_size: (row.font_size as string) ?? "md",
      theme: (row.theme as string) ?? "dark",
      module_order: (row.module_order as string[] | null) ?? null,
      modules_extra: (row.modules_extra as string[] | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Módulos efectivos (base + opcionales habilitados) de la sesión. */
export async function userModules(session: AdminSession): Promise<string[]> {
  const prefs = await getUserPrefs(session.email);
  return effectiveModules(session.role, prefs?.modules_extra);
}

/** Guard de página por módulo: si el usuario no lo tiene habilitado, lo manda a Producción. */
export async function requireModule(href: string): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  const mods = await userModules(s);
  if (!mods.includes(href)) redirect("/admin/produccion");
  return s;
}
