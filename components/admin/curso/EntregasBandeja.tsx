"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Inbox, Send } from "lucide-react";
import type { EntregaAdmin } from "@/lib/cursos-admin";
import { NIVELES_RUBRICA } from "@/lib/cursos-tipos";
import { inp, lblS } from "@/components/admin/tareas/estilos";
import { toast } from "@/lib/toast";
import { api, errorDe } from "./api";

const fecha = (iso: string) => new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const esAudio = (e: EntregaAdmin) => (e.mime ?? "").startsWith("audio/");
// Los filtros miden lo que su texto, no todo el renglón (inp trae w-full).
const selFiltro = `${inp.replace("w-full", "")} w-auto`;

/** Bandeja de entregas: lista a la izquierda, la seleccionada con su video y la retro a la derecha. */
export function EntregasBandeja({ entregas, cursos, cursoId, estado }: {
  entregas: EntregaAdmin[]; cursos: { id: string; titulo: string }[]; cursoId: string; estado: string;
}) {
  const router = useRouter();
  const [selId, setSelId] = useState<string | null>(entregas[0]?.id ?? null);
  const sel = entregas.find((e) => e.id === selId) ?? null;

  const filtrar = (c: string, e: string) => {
    const q = new URLSearchParams();
    if (c) q.set("curso", c);
    if (e) q.set("estado", e);
    router.push(`/admin/cursos/entregas${q.toString() ? `?${q}` : ""}`);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={cursoId} onChange={(e) => filtrar(e.target.value, estado)} className={selFiltro} aria-label="Curso">
          <option value="">Todos los cursos</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
        </select>
        <select value={estado} onChange={(e) => filtrar(cursoId, e.target.value)} className={selFiltro} aria-label="Estado">
          <option value="">Todas</option>
          <option value="enviada">Por revisar</option>
          <option value="revisada">Revisadas</option>
        </select>
      </div>

      {entregas.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          <Inbox size={36} strokeWidth={1} className="mx-auto mb-3" />
          <p className="text-sm">No hay entregas con este filtro.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <ul className="flex flex-col gap-1.5 lg:max-h-[75vh] lg:overflow-y-auto scroll-sutil">
            {entregas.map((e) => (
              <li key={e.id}>
                <button onClick={() => setSelId(e.id)}
                  className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition-colors cursor-pointer ${selId === e.id ? "border-white/30 bg-white/[0.06]" : "border-white/8 bg-white/[0.02] hover:border-white/20"}`}>
                  <div className="flex items-center gap-2">
                    {e.estado === "revisada" ? <CheckCircle2 size={14} className="text-green-400 shrink-0" /> : <Clock size={14} className={e.conRevision ? "text-amber-300 shrink-0" : "text-white/30 shrink-0"} />}
                    <span className="text-sm truncate flex-1">{e.email}</span>
                  </div>
                  <p className="text-[11px] text-white/50 mt-0.5 truncate">{e.leccionTitulo} · {fecha(e.createdAt)}</p>
                  {!e.conRevision && <p className="text-[11px] text-white/40">Sin revisión incluida (autoevaluación)</p>}
                </button>
              </li>
            ))}
          </ul>
          {sel && <DetalleEntrega key={sel.id} entrega={sel} onSaved={() => router.refresh()} />}
        </div>
      )}
    </div>
  );
}

function DetalleEntrega({ entrega, onSaved }: { entrega: EntregaAdmin; onSaved: () => void }) {
  const [retro, setRetro] = useState(entrega.retro ?? "");
  const [notas, setNotas] = useState<Record<string, number>>(entrega.rubricaProfe);
  const [busy, setBusy] = useState(false);
  const src = `/api/admin/cursos/entregas/${entrega.id}/archivo`;

  const guardar = async () => {
    setBusy(true);
    try {
      await api("/api/admin/cursos/entregas", "PATCH", { id: entrega.id, retro, rubrica_profe: notas });
      toast(entrega.estado === "revisada" ? "Retroalimentación actualizada" : "Enviada al alumno");
      onSaved();
    } catch (e) { toast(errorDe(e)); }
    finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 flex flex-col gap-4 min-w-0">
      <div>
        <p className="text-sm font-medium">{entrega.leccionTitulo}</p>
        <p className="text-xs text-white/50">{entrega.cursoTitulo} · {entrega.email} · {entrega.nombre}</p>
      </div>
      {esAudio(entrega)
        ? <audio src={src} controls preload="metadata" className="w-full" />
        : <video src={src} controls preload="metadata" className="w-full max-h-[60vh] rounded-xl bg-black" />}

      {entrega.comentarioAlumno && (
        <p className="text-sm text-white/80 border-l-2 border-white/20 pl-3 whitespace-pre-line">“{entrega.comentarioAlumno}”</p>
      )}

      {entrega.rubrica.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className={lblS}>Rúbrica · el alumno se dio · tú le das</p>
          {entrega.rubrica.map((r) => (
            <div key={r.criterio}>
              <p className="text-sm mb-1">
                {r.criterio} <span className="text-white/50 text-xs">· se dio {entrega.autoevaluacion[r.criterio] ?? "—"}/4</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {NIVELES_RUBRICA.map((n, k) => (
                  <button key={n} onClick={() => setNotas({ ...notas, [r.criterio]: k + 1 })} aria-pressed={notas[r.criterio] === k + 1}
                    className={`text-xs px-2.5 py-1 rounded-full cursor-pointer transition-colors ${notas[r.criterio] === k + 1 ? "bg-white/20 text-white" : "bg-white/5 text-white/60 hover:text-white"}`}>
                    {k + 1} · {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="block">
        <span className={lblS}>Retroalimentación (le llega por correo y la ve en su lección)</span>
        <textarea value={retro} onChange={(e) => setRetro(e.target.value)} rows={6} className={`${inp} resize-y`}
          placeholder="Qué está bien, qué ajustar primero y cómo practicarlo esta semana." />
      </label>
      <button onClick={guardar} disabled={busy || !retro.trim()}
        className="self-start flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-40 cursor-pointer">
        <Send size={14} /> {busy ? "Enviando…" : entrega.estado === "revisada" ? "Actualizar" : "Enviar retroalimentación"}
      </button>
    </section>
  );
}
