import { getSession, requireModule } from "@/lib/supabase/auth-server";
import { getAnalitica } from "@/lib/analitica";
import { AnaliticaPanel } from "@/components/admin/AnaliticaPanel";
import { getResumenOrigenes } from "@/lib/origenes-data";
import { OrigenesPanel } from "@/components/admin/OrigenesPanel";

export const dynamic = "force-dynamic";

export default async function AnaliticaPage() {
  await requireModule("/admin/analitica");
  const session = await getSession();
  const isAdmin = session?.role === "admin";
  const [data, origenes] = await Promise.all([getAnalitica(), getResumenOrigenes()]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Analítica</h1>
        <p className="text-white/40 text-sm mt-1">De dónde llegan los clientes y cómo rinde tu contenido.</p>
      </div>
      <OrigenesPanel data={origenes} isAdmin={isAdmin} />
      <div className="mt-10">
        <AnaliticaPanel data={data} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
