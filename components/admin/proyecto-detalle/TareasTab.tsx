"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Eye, EyeOff, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/lib/toast";
import { esContenido, type Equipo } from "@/components/admin/ProduccionBoard";
import type { ProyectoDetalle, ProyectoTarea } from "@/lib/erp-data";

/**
 * Checklist del proyecto — mismas acciones que la tarjeta del kanban (marcar,
 * ocultar al cliente, agregar, borrar). El reordenamiento aquí es con flechas
 * en vez de arrastrar: mismo endpoint (`orden_ids`) que ya usa el kanban con
 * dnd-kit, solo que sin duplicar esa maquinaria de drag para una lista que en
 * una página de detalle rara vez necesita reordenarse a la carrera.
 */
export function TareasTab({ proyecto, equipo }: { proyecto: ProyectoDetalle; equipo: Equipo[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [nuevaResp, setNuevaResp] = useState("");
  const [creando, setCreando] = useState(false);

  const api = async (method: string, body: Record<string, unknown>) => {
    const r = await fetch("/api/admin/proyecto-tareas", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) router.refresh();
    else toast("⚠️ No se pudo guardar");
    return r.ok;
  };

  const toggle = async (t: ProyectoTarea) => { setBusyId(t.id); await api("PATCH", { id: t.id, hecho: !t.hecho }); setBusyId(null); };
  const toggleVisible = async (t: ProyectoTarea) => { setBusyId(t.id); await api("PATCH", { id: t.id, visible_cliente: !t.visible_cliente }); setBusyId(null); };
  const borrar = async (t: ProyectoTarea) => { setBusyId(t.id); await api("DELETE", { id: t.id }); setBusyId(null); };
  const mover = async (idx: number, dir: -1 | 1) => {
    const ids = proyecto.tareas.map((t) => t.id);
    const otro = idx + dir;
    if (otro < 0 || otro >= ids.length) return;
    [ids[idx], ids[otro]] = [ids[otro], ids[idx]];
    await api("PATCH", { orden_ids: ids });
  };
  const agregar = async () => {
    const titulo = nuevaTarea.trim();
    if (!titulo) return;
    setCreando(true);
    const ok = await api("POST", { proyecto_id: proyecto.id, titulo, responsable_id: nuevaResp || null });
    if (ok) setNuevaTarea("");
    setCreando(false);
  };

  const hechas = proyecto.tareas.filter((t) => t.hecho).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{hechas} de {proyecto.tareas.length} completadas</p>
        <div className="h-1.5 w-40 rounded-full bg-white/8 overflow-hidden">
          <motion.div className="h-full bg-lgb-red rounded-full" initial={{ width: 0 }} animate={{ width: `${proyecto.progreso}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
        </div>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {proyecto.tareas.map((t, i) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 group rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2">
              <button onClick={() => toggle(t)} disabled={busyId === t.id}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${t.hecho ? "bg-green-500/30 border-green-400/50" : "border-white/20"}`}>
                {t.hecho && <Check size={11} className="text-green-300" />}
              </button>
              <span className={`text-sm flex-1 truncate ${t.hecho ? "text-white/30 line-through" : "text-white/80"}`}>
                {t.revision > 0 && <span className="text-[9px] font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 rounded-full px-1.5 mr-1.5 align-middle">R{t.revision}</span>}
                {t.titulo}
                {t.subtareas.length > 0 && <span className="text-white/30 ml-1">({t.subtareas.filter((s) => s.hecho).length}/{t.subtareas.length})</span>}
              </span>
              {t.responsable && <span className="text-[11px] text-white/35 shrink-0">{t.responsable.split(" ")[0]}</span>}
              {proyecto.clase === "produccion" && !esContenido(proyecto.tipo) && (
                <button onClick={() => toggleVisible(t)} title={t.visible_cliente ? "Visible al cliente" : "Oculta al cliente"}
                  className={`shrink-0 ${t.visible_cliente ? "text-lgb-red/70 hover:text-lgb-red" : "text-white/20 hover:text-white/50"}`}>
                  {t.visible_cliente ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
              )}
              <div className="flex flex-col shrink-0 opacity-0 group-hover:opacity-100">
                <button onClick={() => mover(i, -1)} disabled={i === 0} className="text-white/30 hover:text-white disabled:opacity-20"><ChevronUp size={12} /></button>
                <button onClick={() => mover(i, 1)} disabled={i === proyecto.tareas.length - 1} className="text-white/30 hover:text-white disabled:opacity-20"><ChevronDown size={12} /></button>
              </div>
              <button onClick={() => borrar(t)} className="text-white/20 hover:text-red-300 opacity-0 group-hover:opacity-100 shrink-0"><X size={13} /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-2">
        <input value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregar()}
          placeholder="+ agregar tarea" className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-lgb-red flex-1 min-w-0" />
        <select value={nuevaResp} onChange={(e) => setNuevaResp(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lgb-red">
          <option value="" className="bg-lgb-dark">Sin asignar</option>
          {equipo.map((m) => <option key={m.id} value={m.id} className="bg-lgb-dark">{m.nombre.split(" ")[0]}</option>)}
        </select>
        <button onClick={agregar} disabled={creando || !nuevaTarea.trim()} className="bg-white/10 hover:bg-white/15 text-white px-3 rounded-lg text-sm disabled:opacity-40 shrink-0">
          {creando ? <Loader2 size={14} className="animate-spin" /> : "Agregar"}
        </button>
      </div>
    </div>
  );
}
