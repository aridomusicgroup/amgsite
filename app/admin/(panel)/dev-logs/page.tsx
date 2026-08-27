import { redirect } from "next/navigation";
import { getDevEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { DevLogsPanel } from "@/components/admin/DevLogsPanel";

export const dynamic = "force-dynamic";

export default async function DevLogsPage() {
  const email = await getDevEmail();
  if (!email) redirect("/admin/produccion");

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("reaper_sync_logs")
    .select("id, nivel, mensaje, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">Logs · reaper-sync</h1>
        <p className="text-white/40 text-sm mt-1">
          Consola en vivo del script local que crea las carpetas y proyectos de REAPER. Solo tú puedes ver esto.
        </p>
      </div>
      <DevLogsPanel logs={data ?? []} />
    </div>
  );
}
