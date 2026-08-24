import { getSession, requireModule } from "@/lib/supabase/auth-server";
import { getAnalitica } from "@/lib/analitica";
import { AnaliticaPanel } from "@/components/admin/AnaliticaPanel";

export const dynamic = "force-dynamic";

export default async function AnaliticaPage() {
  await requireModule("/admin/analitica");
  const session = await getSession();
  const isAdmin = session?.role === "admin";
  const data = await getAnalitica();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Analítica</h1>
        <p className="text-white/40 text-sm mt-1">Instagram y Facebook · rendimiento de tu contenido.</p>
      </div>
      <AnaliticaPanel data={data} isAdmin={isAdmin} />
    </div>
  );
}
