import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { getSession, getUserPrefs } from "@/lib/supabase/auth-server";
import { effectiveModules } from "@/lib/modules";
import { getPerfil } from "@/lib/usuarios";
import { AdminNav } from "@/components/admin/AdminNav";
import { Toaster } from "@/components/admin/Toaster";
import { PrefsApplier } from "@/components/admin/PrefsApplier";
import { NotificacionRouter } from "@/components/admin/NotificacionRouter";
import { DiagnosticoScroll } from "@/components/admin/DiagnosticoScroll";

// PWA: manifest + comportamiento de app instalada en iOS (para el push).
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ARIDO", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#0a0a0a" };

/** Layout protegido: solo entra quien tenga sesión y esté autorizado. */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const [prefs, perfil] = await Promise.all([getUserPrefs(session.email), getPerfil(session.email)]);
  const modules = effectiveModules(session.role, prefs?.modules_extra);
  const light = prefs?.theme === "light";

  return (
    <div className={`min-h-screen ${light ? "panel-light" : ""} bg-lgb-black text-white flex flex-col md:flex-row`}>
      <PrefsApplier fontSize={prefs?.font_size ?? "md"} />
      <NotificacionRouter />
      <DiagnosticoScroll />
      <AdminNav email={session.email} nombre={perfil.nombre} foto={perfil.foto_url} modules={modules} order={prefs?.module_order ?? null} />
      <main className="flex-1 min-w-0 md:ml-60 p-5 sm:p-8 pb-32 md:pb-8">{children}</main>
      <Toaster />
    </div>
  );
}
