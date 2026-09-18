"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Loader2, Plus } from "lucide-react";

/**
 * La bitácora: el hábito hecho visible. Racha de días seguidos, minutos de la
 * semana contra la meta y botones de un toque para registrar la práctica.
 */
export function BitacoraPractica({ cursoId, racha, semana, meta, hoy }: {
  cursoId: string; racha: number; semana: number; meta: number; hoy: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pct = Math.min(100, Math.round((semana / Math.max(1, meta)) * 100));

  const registrar = async (minutos: number) => {
    setBusy(minutos); setErr(null);
    const res = await fetch(`/api/cuenta/curso/${cursoId}/practica`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minutos }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) { setErr("No se pudo guardar. Intenta de nuevo."); return; }
    router.refresh();
  };

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4" aria-label="Bitácora de práctica">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Flame size={22} className={racha > 0 ? "text-orange-400" : "text-white/20"} />
          <div>
            <p className="font-coolvetica text-2xl leading-none">{racha}</p>
            <p className="text-[11px] text-white/50">día{racha === 1 ? "" : "s"} seguido{racha === 1 ? "" : "s"}</p>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between text-[11px] text-white/50 mb-1">
            <span>Esta semana: {semana} min</span>
            <span>Meta {meta}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-white/40 mt-1">{hoy > 0 ? `Hoy llevas ${hoy} min.` : "Hoy todavía no registras práctica."}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <span className="text-xs text-white/50 mr-1">¿Cuánto practicaste?</span>
        {[15, 30, 60].map((m) => (
          <button key={m} onClick={() => registrar(m)} disabled={busy != null}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-white/8 text-white/80 hover:bg-white/15 transition-colors cursor-pointer disabled:opacity-50">
            {busy === m ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {m} min
          </button>
        ))}
      </div>
      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
    </section>
  );
}
