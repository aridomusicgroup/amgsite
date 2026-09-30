"use client";
import { useState } from "react";
import Link from "next/link";
import { Cloud, ChevronRight } from "lucide-react";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { BotonesRender, EnCurso, EN_VUELO, TIPO_TXT, useEncolarRender } from "./RenderControles";
import { ESTADO_PROY_LABEL, ESTADO_PROY_COLOR, ESTADO_PROY_BORDE } from "@/lib/erp-data";
import type { Renderizable, TipoRender, MusicoLite } from "@/lib/render-jobs";

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

/**
 * Hace cuánto que el script local dio señales de vida.
 *
 * `publicarInventario` reescribe `escaneado_en` en CADA corrida, con cambios o
 * sin ellos, así que es un latido de verdad — a diferencia de la Consola, que
 * sólo tiene renglones cuando hubo algo que contar.
 *
 * Esa diferencia importa: el 9-sep un previo esperó 81 min con el panel
 * diciendo "revisa la Consola", y la Consola estaba muda porque el script
 * llevaba 2.5 h sin correr. El aviso mandaba a mirar justo donde no había nada.
 */
function latido(proyectos: Renderizable[]): number | null {
  const ultimo = proyectos
    .map((p) => p.inventario?.escaneadoEn)
    .filter(Boolean)
    .sort()
    .at(-1);
  return ultimo ? (Date.now() - new Date(ultimo).getTime()) / 60000 : null;
}

/** Corre cada 2 min: más de 8 es que la tarea de Windows no está disparando. */
const LATIDO_MAX_MIN = 8;

export function DevLogsPanel({ logs, proyectos, musicos }: { logs: LogRow[]; proyectos: Renderizable[]; musicos: MusicoLite[] }) {
  const [tab, setTab] = useState<"renders" | "logs">("renders");
  const { abrir, cuadro } = useEncolarRender();

  useRealtimeRefresh("rt-dev-logs", ["reaper_sync_logs", "render_jobs", "render_inventario"]);

  const chip = (activo: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${activo ? "bg-lgb-red text-white" : "bg-white/5 text-white/60 hover:text-white"}`;

  const min = latido(proyectos);
  const dormido = min !== null && min > LATIDO_MAX_MIN;

  return (
    <div>
      {dormido && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3">
          <p className="text-sm text-red-300">
            El script de la computadora del estudio no ha corrido en {min < 60 ? `${min.toFixed(0)} min` : `${(min / 60).toFixed(1)} h`}.
          </p>
          <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
            Nada de la cola va a avanzar hasta que vuelva. Suele ser la PC dormida, o una
            instancia colgada: la tarea de Windows está en <b className="text-white/70">IgnoreNew</b>,
            así que mientras una siga viva se salta cada disparo en silencio. Revisa que
            <b className="text-white/70"> ReaperSync</b> esté corriendo en el Programador de tareas.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button onClick={() => setTab("renders")} className={chip(tab === "renders")}>
          Renders <span className="opacity-60">({proyectos.length})</span>
        </button>
        <button onClick={() => setTab("logs")} className={chip(tab === "logs")}>
          Consola
        </button>
      </div>

      {tab === "renders" ? (
        <RenderList proyectos={proyectos} onAbrir={abrir} />
      ) : (
        <Consola logs={logs} />
      )}

      {cuadro(musicos)}
    </div>
  );
}

function RenderList({ proyectos, onAbrir }: {
  proyectos: Renderizable[];
  onAbrir: (p: Renderizable, t: TipoRender) => void;
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
        const enDrive = p.jobs.find((j) => j.estado === "listo" && j.driveUrls?.length);

        return (
          <div
            key={p.key}
            className={`bg-lgb-surface border border-white/5 border-l-4 rounded-2xl p-3 sm:p-4 ${
              ESTADO_PROY_BORDE[p.estado] ?? "border-l-white/10"
            }`}
          >
            {/* En vertical el título va en su propio renglón: compartir la fila
                con cuatro botones lo dejaba en una columna de ~90px y el nombre
                se partía letra por letra. */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
              <div className="min-w-0 sm:flex-1">
                {/* Abre la ficha de REAPER de ese proyecto (o de ese tema, en
                    un EP): músicos, previos al cliente, stems y edición en una
                    sola vista, sin tener que irse a Producción. */}
                <Link
                  href={`/admin/dev-logs/${p.key}`}
                  title="Ver todo lo de este proyecto"
                  className="group inline-flex items-start gap-1 text-sm font-medium break-words hover:text-lgb-red transition-colors"
                >
                  <span>
                    {p.album && <span className="text-white/40 group-hover:text-lgb-red/60">{p.album} · </span>}
                    {p.titulo}
                  </span>
                  <ChevronRight size={14} className="mt-0.5 shrink-0 opacity-30 group-hover:opacity-100 transition-opacity" />
                </Link>
                <p className="text-white/40 text-xs mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${ESTADO_PROY_COLOR[p.estado] ?? "bg-white/10 text-white/50"}`}>
                    {ESTADO_PROY_LABEL[p.estado] ?? p.estado}
                  </span>
                  <span>
                    {p.cliente}
                    {p.folio && ` · ${p.folio}`}
                    {p.ultimoPrevio > 0 && ` · último previo: ${p.ultimoPrevio}`}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                <BotonesRender p={p} onAbrir={onAbrir} />
              </div>
            </div>

            {enVuelo && <EnCurso job={enVuelo} />}
            {enDrive && (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2">
                <span className="flex items-center gap-1 text-[11px] text-white/30 shrink-0">
                  <Cloud size={12} /> {TIPO_TXT[enDrive.tipo] ?? enDrive.tipo} en Drive:
                </span>
                {enDrive.driveUrls!.map((d) => (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-white/50 hover:text-white underline underline-offset-2 truncate max-w-[180px]"
                  >
                    {d.archivo}
                  </a>
                ))}
              </div>
            )}
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
