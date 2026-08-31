"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Music4, Package, Layers, Loader2 } from "lucide-react";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { toast } from "@/lib/toast";
import type { Renderizable, TipoRender, RenderJob } from "@/lib/render-jobs";

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

/** Estados que significan "hay algo corriendo, no pidas otro". */
const EN_VUELO = ["pendiente", "renderizando", "subiendo"];

/**
 * Cuánto tarda cada render, medido sobre canciones reales de ~3 min con la
 * cadena de plugins completa. Se muestra en pantalla porque sin esto un
 * "en cola" de 12 minutos se ve idéntico a que algo se trabó.
 */
const MINUTOS: Record<TipoRender, number> = { previo: 4, entregables: 10, stems: 6 };

const TIPO_TXT: Record<string, string> = { previo: "Previo", entregables: "Entregables", stems: "Stems" };

const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function DevLogsPanel({ logs, proyectos }: { logs: LogRow[]; proyectos: Renderizable[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"renders" | "logs">("renders");
  const [pidiendo, setPidiendo] = useState<string | null>(null);

  useRealtimeRefresh("rt-dev-logs", ["reaper_sync_logs", "render_jobs"]);

  const pedir = async (p: Renderizable, tipo: TipoRender) => {
    const clave = `${p.key}:${tipo}`;
    setPidiendo(clave);
    try {
      const res = await fetch("/api/admin/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId: p.proyectoId, tareaId: p.tareaId, tipo }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Error");
      toast("✓ En cola — REAPER lo toma en menos de 2 min");
      router.refresh();
    } catch (e) {
      toast(`⚠️ ${e instanceof Error ? e.message : "No se pudo encolar"}`);
    } finally {
      setPidiendo(null);
    }
  };

  const chip = (activo: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${activo ? "bg-lgb-red text-white" : "bg-white/5 text-white/60 hover:text-white"}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={() => setTab("renders")} className={chip(tab === "renders")}>
          Renders <span className="opacity-60">({proyectos.length})</span>
        </button>
        <button onClick={() => setTab("logs")} className={chip(tab === "logs")}>
          Consola
        </button>
      </div>

      {tab === "renders" ? (
        <RenderList proyectos={proyectos} pidiendo={pidiendo} onPedir={pedir} />
      ) : (
        <Consola logs={logs} />
      )}
    </div>
  );
}

function RenderList({ proyectos, pidiendo, onPedir }: {
  proyectos: Renderizable[];
  pidiendo: string | null;
  onPedir: (p: Renderizable, t: TipoRender) => void;
}) {
  if (proyectos.length === 0) {
    return (
      <div className="text-center text-white/40 text-sm py-16 border border-dashed border-white/10 rounded-2xl">
        No hay producciones de cliente abiertas.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {proyectos.map((p) => {
        const enVuelo = p.jobs.find((j) => EN_VUELO.includes(j.estado));
        const ultimoError = !enVuelo && p.jobs[0]?.estado === "error" ? p.jobs[0] : null;

        return (
          <div key={p.key} className="bg-lgb-surface border border-white/5 rounded-2xl p-3 sm:p-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">
                  {p.album && <span className="text-white/40">{p.album} · </span>}
                  {p.titulo}
                </p>
                <p className="text-white/40 text-xs mt-0.5">
                  {p.cliente}
                  {p.folio && ` · ${p.folio}`}
                  {p.ultimoPrevio > 0 && ` · último previo: ${p.ultimoPrevio}`}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <BotonRender
                  icono={<Music4 size={14} />}
                  texto={p.ultimoPrevio > 0 ? `Previo ${p.ultimoPrevio + 1}` : "Previo"}
                  titulo={`MP3 128 kbps / 44.1 kHz · tarda ~${MINUTOS.previo} min`}
                  ocupado={pidiendo === `${p.key}:previo`}
                  deshabilitado={!!enVuelo}
                  onClick={() => onPedir(p, "previo")}
                />
                <BotonRender
                  icono={<Package size={14} />}
                  texto="Entregables"
                  titulo={`MP3 320 kbps / 48 kHz + WAV 32-bit · tarda ~${MINUTOS.entregables} min`}
                  ocupado={pidiendo === `${p.key}:entregables`}
                  deshabilitado={!!enVuelo}
                  onClick={() => onPedir(p, "entregables")}
                />
                <BotonRender
                  icono={<Layers size={14} />}
                  texto="Stems"
                  titulo={`WAV 24-bit por grupo, con mezcla y máster · tarda ~${MINUTOS.stems} min`}
                  ocupado={pidiendo === `${p.key}:stems`}
                  deshabilitado={!!enVuelo}
                  onClick={() => onPedir(p, "stems")}
                />
              </div>
            </div>

            {enVuelo && <EnCurso job={enVuelo} />}
            {ultimoError && (
              <p className="text-[11px] text-red-300 mt-2 break-words">
                ✗ {ultimoError.tipo}: {ultimoError.error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Estado de un render en curso, con el tiempo que lleva y el que se espera.
 *
 * El reloj corre en el cliente: sin él, un trabajo largo se ve congelado y la
 * reacción natural es volver a picarle o pensar que se rompió (ya pasó).
 */
function EnCurso({ job }: { job: RenderJob }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  const min = Math.max(0, Math.floor((ahora - new Date(job.createdAt).getTime()) / 60000));
  const esperado = MINUTOS[job.tipo] ?? 8;
  const tarde = min > esperado + 5;

  const detalle =
    job.estado === "pendiente"
      ? "en cola — REAPER lo toma en menos de 2 min"
      : job.estado === "subiendo"
        ? "subiendo a Drive…"
        : `renderizando… (suele tardar ~${esperado} min)`;

  return (
    <p className={`text-[11px] mt-2 flex items-center gap-1.5 ${tarde ? "text-red-300" : "text-amber-300"}`}>
      <Loader2 size={12} className="animate-spin" />
      {TIPO_TXT[job.tipo] ?? job.tipo} · {detalle} · lleva {min} min
      {tarde && " · más de lo normal, revisa la Consola"}
    </p>
  );
}

function BotonRender({ icono, texto, titulo, ocupado, deshabilitado, onClick }: {
  icono: React.ReactNode; texto: string; titulo?: string; ocupado: boolean; deshabilitado: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={deshabilitado ? "Espera a que termine el render en curso" : titulo}
      disabled={ocupado || deshabilitado}
      className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {ocupado ? <Loader2 size={14} className="animate-spin" /> : icono}
      {texto}
    </button>
  );
}

function Consola({ logs }: { logs: LogRow[] }) {
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
