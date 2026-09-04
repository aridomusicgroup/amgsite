import { redirect } from "next/navigation";
import { getSession, getUserPrefs } from "@/lib/supabase/auth-server";
import { seedUsuariosFromEnv, listUsuarios, getPerfil } from "@/lib/usuarios";
import { effectiveModules } from "@/lib/modules";
import { AjustesPanel } from "@/components/admin/AjustesPanel";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const [prefs, perfil] = await Promise.all([getUserPrefs(session.email), getPerfil(session.email)]);
  const modules = effectiveModules(session.role, prefs?.modules_extra);
  const isAdmin = session.role === "admin";

  // Solo los admins ven y gestionan al equipo. Fuente de verdad: tabla `usuarios`.
  let usuarios: { email: string; role: string; activo: boolean; modules_extra: string[] | null; nombre: string | null; foto_url: string | null }[] = [];
  if (isAdmin) {
    await seedUsuariosFromEnv();            // migra los del entorno la primera vez
    const rows = await listUsuarios();
    usuarios = await Promise.all(rows.map(async (u) => {
      const p = await getUserPrefs(u.email);
      return { email: u.email, role: u.rol, activo: u.activo, modules_extra: p?.modules_extra ?? null, nombre: u.nombre, foto_url: u.foto_url };
    }));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Ajustes</h1>
        <p className="text-white/40 text-sm mt-1">
          Personaliza tu panel{isAdmin ? " y gestiona los accesos del equipo" : ""}.
        </p>
      </div>
      <AjustesPanel
        fontSize={prefs?.font_size ?? "md"}
        theme={prefs?.theme ?? "dark"}
        moduleOrder={prefs?.module_order ?? null}
        modules={modules}
        isAdmin={isAdmin}
        usuarios={usuarios}
        selfEmail={session.email}
        selfNombre={perfil.nombre}
        selfFoto={perfil.foto_url}
      />
    </div>
  );
}
