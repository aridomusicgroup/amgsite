import { requireModule } from "@/lib/supabase/auth-server";
import { ActividadPanel } from "@/components/admin/ActividadPanel";

export const dynamic = "force-dynamic";

export default async function ActividadPage() {
  const session = await requireModule("/admin/actividad");

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Actividad</h1>
        <p className="text-white/40 text-sm mt-1">
          Quién hizo qué y cuándo, en todo el panel. Se actualiza en vivo.
        </p>
      </div>
      <ActividadPanel isAdmin={session.role === "admin"} />
    </div>
  );
}
