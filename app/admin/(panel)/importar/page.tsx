import { requireModule } from "@/lib/supabase/auth-server";
import { ImportPanel } from "@/components/admin/ImportPanel";
import { ReconciliarButton } from "@/components/admin/ReconciliarButton";
import { ImportBeatStarsCsv } from "@/components/admin/ImportBeatStarsCsv";
import { ImportBeatStarsVentas } from "@/components/admin/ImportBeatStarsVentas";
import { DedupButton } from "@/components/admin/DedupButton";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const session = await requireModule("/admin/importar");
  const isAdmin = session.role === "admin";

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Importar y conectar</h1>
        <p className="text-white/40 text-sm mt-1">
          Siembra, reconcilia y conecta los datos del negocio.
        </p>
      </div>

      <div className="space-y-5">
        {/* El import del sheet financiero (INGRESOS/EGRESOS) solo para admins. */}
        {isAdmin && <ImportPanel />}
        <ImportBeatStarsVentas />
        <ImportBeatStarsCsv />
        <DedupButton />
        <ReconciliarButton />
      </div>
    </div>
  );
}
