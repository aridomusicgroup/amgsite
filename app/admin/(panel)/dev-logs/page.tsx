import { requireModule } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderizables, musicosParaPrevio } from "@/lib/render-jobs";
import { DevLogsPanel } from "@/components/admin/DevLogsPanel";

export const dynamic = "force-dynamic";

export default async function DevLogsPage() {
  // Antes esto estaba pegado a un solo correo. Ahora es un módulo como los
  // demás, así que se reparte desde Ajustes sin tocar código.
  await requireModule("/admin/dev-logs");

  const sb = supabaseAdmin();
  const [{ data: logs }, proyectos, musicos] = await Promise.all([
    sb
      .from("reaper_sync_logs")
      .select("id, nivel, mensaje, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    renderizables().catch(() => []),
    musicosParaPrevio().catch(() => []),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-coolvetica text-3xl">REAPER</h1>
        <p className="text-white/40 text-sm mt-1">
          Renders y consola del script local. Solo tú puedes ver esto.
        </p>
      </div>
      <DevLogsPanel logs={logs ?? []} proyectos={proyectos} musicos={musicos} />
    </div>
  );
}
