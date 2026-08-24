"use client";
import { useState, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Clock, CheckCircle2, AlertTriangle, Layers, Megaphone, UploadCloud, Play, Heart } from "lucide-react";
import type { RendEquipo, RendTarea, RendProyectoMin, RendHora, RendContenido } from "@/lib/erp-data";

const nf = new Intl.NumberFormat("es-MX");

const PERIODOS = [
  { k: "7", label: "Semana" },
  { k: "30", label: "Mes" },
  { k: "90", label: "Trimestre" },
  { k: "todo", label: "Todo" },
] as const;

const ROL_LABEL: Record<string, string> = { socio: "Socio", colaborador: "Colaborador" };
const hoy = () => new Date().toISOString().slice(0, 10);
const cutoffDate = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

interface Stats {
  completadas: number; pctATiempo: number | null; vencidas: number; pendientes: number;
  cycle: number | null; proyActivos: number; contenido: number; distrib: number; horas: number;
  piezasSocial: number; reproduccionesSocial: number; interaccionesSocial: number;
}

export function RendimientoPanel({ equipo, tareas, proyectos, horas, contenido, isAdmin, myId }: {
  equipo: RendEquipo[]; tareas: RendTarea[]; proyectos: RendProyectoMin[]; horas: RendHora[]; contenido: RendContenido[]; isAdmin: boolean; myId: string | null;
}) {
  const [periodo, setPeriodo] = useState("30");
  const cutoff = periodo === "todo" ? null : cutoffDate(Number(periodo));

  const statsFor = useMemo(() => (personId: string): Stats => {
    const inPeriod = (d: string | null) => !!d && (!cutoff || d.slice(0, 10) >= cutoff);
    const mine = tareas.filter((t) => t.responsable_id === personId);
    const completadas = mine.filter((t) => t.hecho && inPeriod(t.completado_at));
    let aTiempo = 0, conFecha = 0, cycleSum = 0, cycleN = 0;
    for (const t of completadas) {
      if (t.fecha_entrega) { conFecha++; if ((t.completado_at ?? "").slice(0, 10) <= t.fecha_entrega) aTiempo++; }
      if (t.completado_at && t.created_at) {
        const dd = (new Date(t.completado_at).getTime() - new Date(t.created_at).getTime()) / 86400000;
        if (dd >= 0) { cycleSum += dd; cycleN++; }
      }
    }
    const pendientes = mine.filter((t) => !t.hecho);
    const vencidas = pendientes.filter((t) => t.fecha_entrega && t.fecha_entrega < hoy());
    const proyActivos = proyectos.filter((p) => (p.responsables.includes(personId) || p.responsable_id === personId) && !["cerrado", "cancelado"].includes(p.estado));
    const contenidoCnt = completadas.filter((t) => t.tipo === "contenido" || t.tipo === "creacion_contenido").length;
    const distrib = completadas.filter((t) => /beatstars|portada|drive|cat[aá]logo/i.test(t.titulo)).length;
    const hrs = horas.filter((h) => h.equipo_id === personId && (!cutoff || h.fecha >= cutoff)).reduce((a, h) => a + h.horas, 0);
    const misPiezas = contenido.filter((c) => c.responsable_id === personId && inPeriod(c.fecha));
    return {
      completadas: completadas.length,
      pctATiempo: conFecha > 0 ? Math.round((aTiempo / conFecha) * 100) : null,
      vencidas: vencidas.length, pendientes: pendientes.length,
      cycle: cycleN > 0 ? cycleSum / cycleN : null, proyActivos: proyActivos.length,
      contenido: contenidoCnt, distrib, horas: hrs,
      piezasSocial: misPiezas.length,
      reproduccionesSocial: misPiezas.reduce((a, c) => a + c.reproducciones, 0),
      interaccionesSocial: misPiezas.reduce((a, c) => a + c.interacciones, 0),
    };
  }, [tareas, proyectos, horas, contenido, cutoff]);

  const visibles = useMemo(() => {
    const list = isAdmin ? equipo : equipo.filter((e) => e.id === myId);
    return [...list].sort((a, b) => statsFor(b.id).completadas - statsFor(a.id).completadas);
  }, [equipo, isAdmin, myId, statsFor]);

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs transition-colors ${active ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`;

  if (!isAdmin && !myId) {
    return <p className="text-white/40 text-sm">No encontramos tu ficha en el equipo. Pídele a un admin que registre tu correo.</p>;
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-5">
        {PERIODOS.map((p) => (
          <button key={p.k} onClick={() => setPeriodo(p.k)} className={chip(periodo === p.k)}>{p.label}</button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {visibles.map((e) => (
          <PersonaCard key={e.id} persona={e} s={statsFor(e.id)} canLogHoras={isAdmin || e.id === myId} />
        ))}
      </div>
    </div>
  );
}

function semaforo(s: Stats): string {
  if (s.pctATiempo === null) return "bg-white/20";
  if (s.pctATiempo >= 85 && s.vencidas === 0) return "bg-green-400";
  if (s.pctATiempo >= 60) return "bg-amber-400";
  return "bg-red-400";
}

function PersonaCard({ persona, s, canLogHoras }: { persona: RendEquipo; s: Stats; canLogHoras: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [hf, setHf] = useState({ fecha: hoy(), horas: "", nota: "" });
  const [busy, setBusy] = useState(false);

  const logHoras = async () => {
    if (!(Number(hf.horas) > 0)) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/horas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipo_id: persona.id, fecha: hf.fecha, horas: hf.horas, nota: hf.nota }),
      });
      if (r.ok) { setOpen(false); setHf({ fecha: hoy(), horas: "", nota: "" }); router.refresh(); }
    } catch { /* noop */ }
    finally { setBusy(false); }
  };

  const kpi = (label: string, value: string, icon: ReactNode, tone = "") => (
    <div className="bg-white/[0.02] border border-white/8 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-white/40 text-[10px] uppercase tracking-wider">{icon} {label}</div>
      <p className={`text-lg font-coolvetica mt-0.5 ${tone}`}>{value}</p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-2.5 h-2.5 rounded-full ${semaforo(s)}`} title="Semáforo de cumplimiento" />
        <h2 className="font-coolvetica text-xl">{persona.nombre}</h2>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">{ROL_LABEL[persona.rol] ?? persona.rol}</span>
        {persona.pago_variable && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lgb-red/20 text-lgb-red">pago variable</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {kpi("Completadas", String(s.completadas), <CheckCircle2 size={11} />)}
        {kpi("A tiempo", s.pctATiempo === null ? "—" : `${s.pctATiempo}%`, <Clock size={11} />, s.pctATiempo !== null && s.pctATiempo < 60 ? "text-red-300" : "")}
        {kpi("Vencidas", String(s.vencidas), <AlertTriangle size={11} />, s.vencidas > 0 ? "text-amber-300" : "")}
        {kpi("Carga", String(s.pendientes), <Layers size={11} />)}
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-xs text-white/50">
        <span>⏱ {s.cycle === null ? "—" : `${s.cycle.toFixed(1)}d`} prom/tarea</span>
        <span>📋 {s.proyActivos} proyectos activos</span>
        {persona.pago_variable && <span className="flex items-center gap-1"><Megaphone size={12} /> {s.contenido} contenido</span>}
        {persona.pago_variable && <span className="flex items-center gap-1"><UploadCloud size={12} /> {s.distrib} distribución</span>}
        {s.horas > 0 && <span className="flex items-center gap-1"><Clock size={12} /> {s.horas} hrs</span>}
      </div>

      {s.piezasSocial > 0 && (
        <div className="mt-3 rounded-xl bg-white/[0.02] border border-white/8 px-3 py-2.5">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Contenido publicado (rendimiento real)</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/70">
            <span>🎬 {nf.format(s.piezasSocial)} piezas</span>
            <span className="flex items-center gap-1"><Play size={12} /> {nf.format(s.reproduccionesSocial)} reproducciones</span>
            <span className="flex items-center gap-1"><Heart size={12} /> {nf.format(s.interaccionesSocial)} interacciones</span>
            {s.piezasSocial > 0 && <span className="text-white/40">≈ {nf.format(Math.round(s.reproduccionesSocial / s.piezasSocial))} views/pieza</span>}
          </div>
        </div>
      )}

      {persona.pago_variable && (
        <div className="mt-3 rounded-xl bg-lgb-red/5 border border-lgb-red/20 px-3 py-2 text-xs text-white/70">
          <b>Scorecard de pago:</b> {s.completadas} tareas · {s.pctATiempo === null ? "sin fechas" : `${s.pctATiempo}% a tiempo`} · {s.contenido} piezas de contenido · {s.distrib} de distribución.
        </div>
      )}

      {canLogHoras && (
        <div className="mt-3">
          {open ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-[10px] text-white/40 mb-1">Fecha</label>
                <input type="date" value={hf.fecha} onChange={(e) => setHf((p) => ({ ...p, fecha: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lgb-red" />
              </div>
              <div>
                <label className="block text-[10px] text-white/40 mb-1">Horas</label>
                <input type="number" step="0.5" value={hf.horas} onChange={(e) => setHf((p) => ({ ...p, horas: e.target.value }))} placeholder="4" className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white w-16 focus:outline-none focus:ring-1 focus:ring-lgb-red" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] text-white/40 mb-1">Nota</label>
                <input value={hf.nota} onChange={(e) => setHf((p) => ({ ...p, nota: e.target.value }))} placeholder="qué hizo" className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lgb-red" />
              </div>
              <button onClick={logHoras} disabled={busy} className="flex items-center gap-1.5 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                {busy ? <Loader2 size={13} className="animate-spin" /> : null} Guardar
              </button>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-xs px-1">✕</button>
            </div>
          ) : (
            <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white">
              <Clock size={12} /> Registrar horas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
