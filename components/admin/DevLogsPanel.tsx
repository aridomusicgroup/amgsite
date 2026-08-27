"use client";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";

interface LogRow {
  id: string;
  nivel: string;
  mensaje: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

const NIVEL_CLS: Record<string, string> = {
  info: "text-green-300",
  warn: "text-amber-300",
  error: "text-red-300",
};
const NIVEL_PREFIX: Record<string, string> = { info: "✓", warn: "⚠", error: "✗" };

const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function DevLogsPanel({ logs }: { logs: LogRow[] }) {
  useRealtimeRefresh("rt-dev-logs", ["reaper_sync_logs"]);

  if (logs.length === 0) {
    return (
      <div className="text-center text-white/40 text-sm py-16 border border-dashed border-white/10 rounded-2xl">
        Todavía no hay actividad registrada.
      </div>
    );
  }

  return (
    <div className="bg-black border border-white/10 rounded-2xl p-4 font-mono text-xs overflow-x-auto">
      <div className="flex flex-col gap-1.5">
        {logs.map((l) => (
          <div key={l.id} className="flex gap-3 items-start">
            <span className="text-white/30 shrink-0">{hora(l.created_at)}</span>
            <span className={`shrink-0 ${NIVEL_CLS[l.nivel] ?? "text-white/60"}`}>{NIVEL_PREFIX[l.nivel] ?? "·"}</span>
            <span className="text-white/80 break-all whitespace-pre-wrap">{l.mensaje}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
