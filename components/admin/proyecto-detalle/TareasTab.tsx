"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Eye, EyeOff, Loader2, GripVertical, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { toast } from "@/lib/toast";
import { esContenido, esContenidoPub } from "@/components/admin/ProduccionBoard";
import { SortableTarea } from "@/components/admin/tareas/SortableTarea";
import { TareaModal } from "@/components/admin/tareas/TareaModal";
import type { Equipo } from "@/components/admin/tareas/estilos";
import { soloHora, estaVencido, fechaLarga, type MiRecordatorio } from "@/lib/recordatorios";
import type { ProyectoDetalle, ProyectoTarea } from "@/lib/erp-data";

const hoy = () => new Date().toISOString().slice(0, 10);
const fechaCorta = (s: string | null) =>
  s ? new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : null;

/**
 * Checklist del proyecto — la MISMA de la tarjeta del kanban, no una versión
 * recortada: se arrastra por los seis puntitos y al tocar el título se abre la
 * ventana de la tarea (subtareas, notas, fecha, responsable, recordatorio).
 *
 * Antes esta pestaña solo dejaba palomear, ocultar y borrar. Como la página de
 * detalle es a donde uno entra "a trabajar la tarea", faltaba justo lo de
 * adentro: las subtareas se contaban (3/6) pero no se podían abrir.
 */
export function TareasTab({ proyecto, equipo, recordatorios, miId }: {
  proyecto: ProyectoDetalle;
  equipo: Equipo[];
  recordatorios: Record<string, MiRecordatorio>;
  miId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [nuevaResp, setNuevaResp] = useState("");
  const [creando, setCreando] = useState(false);
  const [modalTareaId, setModalTareaId] = useState<string | null>(null);

  const T = "/api/admin/proyecto-tareas";
  const api = async (method: string, body: Record<string, unknown>, url = T) => {
    setBusy(true);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) router.refresh();
      else toast("⚠️ No se pudo guardar");
      return r.ok;
    } catch {
      toast("⚠️ No se pudo guardar");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Palomear y el ojito van optimistas: se voltean al instante y el servidor se
  // reconcilia después. Esperar la ida y vuelta para cada palomita hace que
  // marcar seis tareas seguidas se sienta trabado.
  const [optDone, setOptDone] = useState<Record<string, boolean>>({});
  const [optVisible, setOptVisible] = useState<Record<string, boolean>>({});
  useEffect(() => { setOptDone({}); setOptVisible({}); }, [proyecto.tareas]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);
  const hechoDe = (t: ProyectoTarea) => (t.id in optDone ? optDone[t.id] : t.hecho);
  const visibleDe = (t: ProyectoTarea) => (t.id in optVisible ? optVisible[t.id] : t.visible_cliente);

  const toggle = (t: ProyectoTarea) => {
    const nuevo = !hechoDe(t);
    setOptDone((o) => ({ ...o, [t.id]: nuevo }));
    fetch(T, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, hecho: nuevo }) })
      .then((r) => {
        if (!r.ok) throw new Error();
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 900); // reconcilia el avance sin frenar los clics rápidos
      })
      .catch(() => { setOptDone((o) => ({ ...o, [t.id]: !nuevo })); toast("⚠️ No se pudo guardar"); });
  };

  const toggleVisible = (t: ProyectoTarea) => {
    const nuevo = !visibleDe(t);
    setOptVisible((o) => ({ ...o, [t.id]: nuevo }));
    fetch(T, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, visible_cliente: nuevo }) })
      .catch(() => { setOptVisible((o) => ({ ...o, [t.id]: !nuevo })); toast("⚠️ No se pudo guardar"); });
  };

  // Orden optimista: se acomoda al soltar y se guarda de fondo, igual que el kanban.
  const [ordenLocal, setOrdenLocal] = useState<string[] | null>(null);
  useEffect(() => { setOrdenLocal(null); }, [proyecto.tareas]);
  const tareas = ordenLocal
    ? (ordenLocal.map((id) => proyecto.tareas.find((t) => t.id === id)).filter(Boolean) as ProyectoTarea[])
    : proyecto.tareas;

  // Ratón: arranca a los 5px. Táctil: mantén presionado ~180ms, para no secuestrar el scroll.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;
    const ids = tareas.map((t) => t.id);
    const from = ids.indexOf(activeId), to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const nuevo = arrayMove(ids, from, to);
    setOrdenLocal(nuevo);
    fetch(T, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orden_ids: nuevo }) })
      .catch(() => toast("⚠️ No se pudo guardar el orden"));
  };

  const agregar = async () => {
    const titulo = nuevaTarea.trim();
    if (!titulo) return;
    setCreando(true);
    const ok = await api("POST", { proyecto_id: proyecto.id, titulo, responsable_id: nuevaResp || null });
    if (ok) setNuevaTarea("");
    setCreando(false);
  };

  const hechas = tareas.filter(hechoDe).length;
  const conCliente = proyecto.clase === "produccion" && !esContenido(proyecto.tipo);
  const tareaAbierta = tareas.find((t) => t.id === modalTareaId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{hechas} de {tareas.length} completadas</p>
        <div className="h-1.5 w-40 rounded-full bg-white/8 overflow-hidden">
          <motion.div className="h-full bg-lgb-red rounded-full" initial={{ width: 0 }} animate={{ width: `${proyecto.progreso}%` }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {tareas.map((t) => {
              const done = hechoDe(t);
              const subDone = t.subtareas.filter((s) => s.hecho).length;
              const rec = recordatorios[t.id];
              return (
                <SortableTarea key={t.id} id={t.id}>
                  {(h) => (
                    <div className="flex items-center gap-2 group rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2">
                      {/* Los seis puntitos: arrastra para reordenar (es el orden que ve el cliente) */}
                      <span ref={h.setActivatorNodeRef} {...h.attributes} {...h.listeners}
                        title="Arrastra para reordenar"
                        className="touch-none cursor-grab active:cursor-grabbing text-white/25 hover:text-white/60 shrink-0 -ml-1 py-1">
                        <GripVertical size={14} />
                      </span>

                      <button onClick={() => toggle(t)}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${done ? "bg-green-500/30 border-green-400/50" : "border-white/20"}`}>
                        {done && <Check size={11} className="text-green-300" />}
                      </button>

                      <button onClick={() => setModalTareaId(t.id)}
                        title="Abrir la tarea (subtareas, notas, fecha, recordatorio)"
                        className={`text-sm flex-1 min-w-0 truncate text-left hover:text-white transition-colors ${done ? "text-white/30 line-through" : t.revision > 0 ? "text-amber-300/90" : "text-white/80"}`}>
                        {t.revision > 0 && <span className="text-[9px] font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 rounded-full px-1.5 mr-1.5 align-middle">R{t.revision}</span>}
                        {t.titulo}
                        {t.subtareas.length > 0 && <span className="text-white/30 ml-1">({subDone}/{t.subtareas.length})</span>}
                        {t.notas && <span className="text-white/25 ml-1" title="Tiene notas">📝</span>}
                      </button>

                      {/* Mi campanita: solo la ve quien puso el recordatorio */}
                      {rec && (
                        <span title={`Te recuerdo el ${fechaLarga(rec.recordar_at)}`}
                          className={`shrink-0 flex items-center gap-0.5 text-[10px] ${rec.enviado_at ? "text-white/25" : estaVencido(rec) ? "text-red-300" : "text-amber-300"}`}>
                          <Bell size={10} /> {soloHora(rec.recordar_at)}
                        </span>
                      )}
                      {t.metricas && t.metricas.reproducciones > 0 && (
                        <span className="text-[10px] text-white/40 shrink-0" title="Reproducciones">▶️{t.metricas.reproducciones.toLocaleString("es-MX")}</span>
                      )}
                      {t.fecha && <span className={`text-[10px] shrink-0 ${!done && t.fecha < hoy() ? "text-red-300" : "text-white/30"}`}>{fechaCorta(t.fecha)}</span>}
                      {t.responsable && <span className="text-[11px] text-white/35 shrink-0">{t.responsable.split(" ")[0]}</span>}

                      {conCliente && (
                        <button onClick={() => toggleVisible(t)} title={visibleDe(t) ? "Visible al cliente — clic para ocultar" : "Oculta al cliente — clic para mostrar"}
                          className={`shrink-0 ${visibleDe(t) ? "text-lgb-red/70 hover:text-lgb-red" : "text-white/20 hover:text-white/50"}`}>
                          {visibleDe(t) ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                      )}
                      <button onClick={() => api("DELETE", { id: t.id })} className="text-white/20 hover:text-red-300 opacity-0 group-hover:opacity-100 shrink-0"><X size={13} /></button>
                    </div>
                  )}
                </SortableTarea>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {tareas.length === 0 && <p className="text-sm text-white/30">Sin tareas todavía. Agrega la primera abajo.</p>}

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

      {tareaAbierta && (
        <TareaModal
          tarea={tareaAbierta}
          equipo={equipo}
          busy={busy}
          contenido={esContenidoPub(proyecto.tipo)}
          recordatorio={recordatorios[tareaAbierta.id] ?? null}
          miId={miId}
          onClose={() => setModalTareaId(null)}
          onAction={api}
        />
      )}
    </div>
  );
}
