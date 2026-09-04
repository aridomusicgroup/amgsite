"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Check, Loader2, GripVertical, Bell, BellOff } from "lucide-react";
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import type { ProyectoTarea } from "@/lib/erp-data";
import { toast } from "@/lib/toast";
import { fechaLarga, paraInput, sugerenciaInicial, estaVencido, type MiRecordatorio } from "@/lib/recordatorios";
import { SortableTarea } from "./SortableTarea";
import { inp, lblS, type Equipo } from "./estilos";
import { AsignarMusico, type MusicoLite } from "./AsignarMusico";

// ── Ventana grande: detalle de una tarea (notas, responsable, subtareas) ──────
export function TareaModal({ tarea, equipo, busy, contenido, recordatorio, miId, proyectoId, musicos, onClose, onAction }: {
  tarea: ProyectoTarea; equipo: Equipo[]; busy: boolean; contenido: boolean;
  /** Para asignarle la tarea a un músico externo. Sin los dos, el bloque no sale. */
  proyectoId?: string;
  musicos?: MusicoLite[];
  /** MI recordatorio en esta tarea (el de los demás no se ve ni se toca). */
  recordatorio: MiRecordatorio | null;
  miId: string | null;
  onClose: () => void; onAction: (method: string, body: Record<string, unknown>, url: string) => Promise<boolean>;
}) {
  const [titulo, setTitulo] = useState(tarea.titulo);
  const [notas, setNotas] = useState(tarea.notas ?? "");
  const [resp, setResp] = useState(tarea.responsable_id ?? "");
  const [fecha, setFecha] = useState(tarea.fecha ?? "");
  const [linkPost, setLinkPost] = useState(tarea.link_post ?? "");
  const [nuevaSub, setNuevaSub] = useState("");
  const [nuevaSubResp, setNuevaSubResp] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [optSub, setOptSub] = useState<Record<string, boolean>>({});
  const subDoneOf = (s: { id: string; hecho: boolean }) => (s.id in optSub ? optSub[s.id] : s.hecho);
  const router = useRouter();

  // Arrastre + inmediatez de subtareas (como las tareas).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const [ordenSub, setOrdenSub] = useState<string[] | null>(null);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  useEffect(() => { setOrdenSub(null); setOcultas(new Set()); }, [tarea.subtareas]);
  const subBase = tarea.subtareas.filter((s) => !ocultas.has(s.id));
  const subtareas = ordenSub
    ? (ordenSub.map((id) => subBase.find((s) => s.id === id)).filter(Boolean) as typeof subBase)
    : subBase;
  const onDragEndSub = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;
    const ids = subtareas.map((s) => s.id);
    const from = ids.indexOf(activeId), to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const nuevo = arrayMove(ids, from, to);
    setOrdenSub(nuevo);
    fetch("/api/admin/proyecto-subtareas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orden_ids: nuevo }) })
      .catch(() => toast("⚠️ No se pudo guardar el orden"));
  };

  const T = "/api/admin/proyecto-tareas";
  const S = "/api/admin/proyecto-subtareas";
  // Autoguardado estilo Notion: sin botón "Guardar", se persiste solo.
  const guardar = async () => {
    setSaving(true); setSaved(false);
    try {
      await fetch(T, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tarea.id, titulo, notas, responsable_id: resp || null, fecha: fecha || null, link_post: linkPost || null }),
      });
      setSaved(true);
    } finally { setSaving(false); }
  };
  const primeraVez = useRef(true);
  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return; }
    setSaved(false);
    const id = setTimeout(() => { void guardar(); }, 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, notas, resp, fecha, linkPost]);
  const cerrar = async () => { await guardar(); router.refresh(); onClose(); };
  const toggleHecho = () => onAction("PATCH", { id: tarea.id, hecho: !tarea.hecho }, T);
  const addSub = async () => { const t = nuevaSub.trim(); if (t && await onAction("POST", { tarea_id: tarea.id, titulo: t, responsable_id: nuevaSubResp || null }, S)) { setNuevaSub(""); setNuevaSubResp(""); } };
  const toggleSub = (id: string, hecho: boolean) => {
    const nuevo = !hecho;
    setOptSub((o) => ({ ...o, [id]: nuevo })); // instantáneo; se reconcilia al cerrar la ventana
    fetch(S, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, hecho: nuevo }) })
      .catch(() => setOptSub((o) => ({ ...o, [id]: hecho })));
  };
  const setSubResp = (id: string, rid: string) => onAction("PATCH", { id, responsable_id: rid || null }, S);
  const delSub = (id: string) => { setOcultas((o) => new Set(o).add(id)); onAction("DELETE", { id }, S); }; // se va al instante

  const subDone = subtareas.filter(subDoneOf).length;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={cerrar}>
      <div className="bg-lgb-dark border border-white/15 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[88vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <button onClick={toggleHecho} className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 ${tarea.hecho ? "bg-green-500/30 border-green-400/50" : "border-white/25"}`}>
            {tarea.hecho && <Check size={13} className="text-green-300" />}
          </button>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)}
            className="flex-1 bg-transparent text-lg font-coolvetica text-white focus:outline-none border-b border-transparent focus:border-white/20" />
          <button onClick={cerrar} className="text-white/40 hover:text-white shrink-0"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className={lblS}>Responsable</label>
            <select value={resp} onChange={(e) => setResp(e.target.value)} className={inp}>
              <option value="" className="bg-lgb-dark">— sin asignar</option>
              {equipo.map((m) => <option key={m.id} value={m.id} className="bg-lgb-dark">{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={lblS}>Fecha <span className="text-white/25">(sale en el calendario)</span></label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inp} />
          </div>
        </div>

        <RecordatorioTarea tareaId={tarea.id} actual={recordatorio} responsableId={tarea.responsable_id ?? null} equipo={equipo} miId={miId} />

        <label className={lblS}>Notas</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={4} placeholder="Detalles, referencias, links…" className={`${inp} mb-3`} />

        {contenido && (
          <>
            <label className={lblS}>Link del post <span className="text-white/25">(reel/publicación · trae métricas reales)</span></label>
            <input value={linkPost} onChange={(e) => setLinkPost(e.target.value)} placeholder="https://instagram.com/reel/…" className={inp} />
            {tarea.metricas && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/60 bg-white/[0.03] border border-white/8 rounded-lg px-2.5 py-2 mt-1.5">
                <span className="text-white/35">Métricas reales:</span>
                {tarea.metricas.reproducciones > 0 && <span title="Reproducciones">▶️ {tarea.metricas.reproducciones.toLocaleString("es-MX")}</span>}
                <span title="Me gusta">❤️ {tarea.metricas.likes.toLocaleString("es-MX")}</span>
                <span title="Comentarios">💬 {tarea.metricas.comentarios.toLocaleString("es-MX")}</span>
                {tarea.metricas.compartidos > 0 && <span title="Compartidos">🔁 {tarea.metricas.compartidos.toLocaleString("es-MX")}</span>}
                {tarea.metricas.guardados > 0 && <span title="Guardados">🔖 {tarea.metricas.guardados.toLocaleString("es-MX")}</span>}
              </div>
            )}
          </>
        )}

        {proyectoId && musicos && (
          <AsignarMusico proyectoId={proyectoId} tareaId={tarea.id} tituloTarea={tarea.titulo} musicos={musicos} />
        )}

        <div className="mt-4">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Subtareas {subtareas.length > 0 && <span className="text-white/40">· {subDone}/{subtareas.length}</span>}</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndSub}>
            <SortableContext items={subtareas.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {subtareas.map((s) => (
                  <SortableTarea key={s.id} id={s.id}>
                    {(h) => (
                      <div className="flex items-center gap-1.5 group">
                        <span ref={h.setActivatorNodeRef} {...h.attributes} {...h.listeners}
                          title="Arrastra para reordenar"
                          className="touch-none cursor-grab active:cursor-grabbing text-white/25 hover:text-white/60 shrink-0 -ml-1 py-1 pr-0.5">
                          <GripVertical size={13} />
                        </span>
                        <button onClick={() => toggleSub(s.id, subDoneOf(s))}
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${subDoneOf(s) ? "bg-green-500/30 border-green-400/50" : "border-white/20"}`}>
                          {subDoneOf(s) && <Check size={11} className="text-green-300" />}
                        </button>
                        <input
                          defaultValue={s.titulo}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== s.titulo) onAction("PATCH", { id: s.id, titulo: v }, S);
                            else if (!v) e.target.value = s.titulo; // no se permite vaciar el título
                          }}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className={`text-sm flex-1 min-w-0 bg-transparent focus:outline-none border-b border-transparent focus:border-white/20 ${subDoneOf(s) ? "text-white/30 line-through" : "text-white/70"}`}
                        />
                        <select value={s.responsable_id ?? ""} onChange={(e) => setSubResp(s.id, e.target.value)} disabled={busy}
                          title="Responsable de la subtarea"
                          className={`shrink-0 max-w-[7.5rem] bg-white/5 border rounded-md px-1.5 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-lgb-red ${s.responsable_id ? "border-lgb-red/40 text-white/80" : "border-white/10 text-white/35"}`}>
                          <option value="" className="bg-lgb-dark">— nadie</option>
                          {equipo.map((m) => <option key={m.id} value={m.id} className="bg-lgb-dark">{m.nombre}</option>)}
                        </select>
                        <button onClick={() => delSub(s.id)} title="Eliminar subtarea" className="text-white/30 hover:text-red-300 shrink-0 p-1"><X size={14} /></button>
                      </div>
                    )}
                  </SortableTarea>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <div className="flex gap-1.5 mt-2">
            <input value={nuevaSub} onChange={(e) => setNuevaSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSub()}
              placeholder="+ subtarea (ej. grabar voz)" className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-lgb-red" />
            <select value={nuevaSubResp} onChange={(e) => setNuevaSubResp(e.target.value)}
              title="Asignar a" className="shrink-0 max-w-[6.5rem] bg-white/5 border border-white/10 rounded-lg px-1.5 py-1.5 text-xs text-white/60 focus:outline-none focus:ring-1 focus:ring-lgb-red">
              <option value="" className="bg-lgb-dark">Nadie</option>
              {equipo.map((m) => <option key={m.id} value={m.id} className="bg-lgb-dark">{m.nombre}</option>)}
            </select>
            <button onClick={addSub} disabled={busy || !nuevaSub.trim()} className="bg-white/10 hover:bg-white/15 text-white px-3 rounded-lg text-sm disabled:opacity-40 shrink-0">Add</button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button onClick={cerrar} className="bg-lgb-red text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-red-700">Listo</button>
          <span className="text-xs text-white/40 flex items-center gap-1">
            {saving ? <><Loader2 size={12} className="animate-spin" /> Guardando…</> : saved ? <><Check size={12} className="text-green-400" /> Guardado</> : "Se guarda solo"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Selector de responsables (uno o varios) ───────────────────────────────────
/**
 * "Recuérdamelo" — el recordatorio personal de esta tarea.
 *
 * Es de quien lo pone, no de la tarea: cada quien ve y edita SOLO el suyo, así
 * que dos personas pueden pedir aviso de lo mismo a horas distintas sin
 * pisarse. Llegada la hora suena el push del panel y llega un correo con el
 * contexto (proyecto, notas y subtareas pendientes).
 *
 * Este bloque NO entra al autoguardado de la ventana: guarda con su propio
 * botón. Un recordatorio que se manda solo mientras escribes la hora acabaría
 * disparando avisos a medio teclear.
 */
function RecordatorioTarea({ tareaId, actual, responsableId, equipo, miId }: {
  tareaId: string;
  actual: MiRecordatorio | null;
  /** Responsable GUARDADO de la tarea. El servidor lo vuelve a resolver contra la base. */
  responsableId: string | null;
  equipo: Equipo[];
  miId: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cuando, setCuando] = useState(() => (actual ? paraInput(actual.recordar_at) : sugerenciaInicial()));
  const [nota, setNota] = useState(actual?.nota ?? "");
  const [guardando, setGuardando] = useState(false);
  const [para, setPara] = useState<"yo" | "responsable" | "ambos">("yo");
  // Lo recién guardado manda sobre lo que llegó del servidor: el `router.refresh()`
  // tarda un instante y sin esto la fila parpadearía de vuelta al valor viejo.
  const [local, setLocal] = useState<MiRecordatorio | null>(actual);

  // Solo tiene sentido elegir si la tarea es de OTRA persona. Si es mía, "a mí"
  // y "al responsable" son lo mismo y el selector solo estorbaría.
  const duenoOtro = responsableId && responsableId !== miId
    ? equipo.find((m) => m.id === responsableId) ?? null
    : null;
  const nombreOtro = duenoOtro?.nombre?.split(" ")[0] ?? "el responsable";

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await fetch("/api/admin/tarea-recordatorio", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarea_id: tareaId, recordar_at: new Date(cuando).toISOString(), nota, para }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo guardar"}`); return; }

      // La fila de arriba es MI recordatorio: solo se pinta si me incluí.
      if (para !== "responsable") {
        setLocal({ recordar_at: new Date(cuando).toISOString(), nota: nota || null, enviado_at: null });
      }
      setAbierto(false);

      const cuandoTxt = fechaLarga(new Date(cuando).toISOString());
      if (d.respetados?.length) {
        toast(`⏰ Guardado. ${nombreOtro} ya tenía el suyo y no se le movió.`);
      } else {
        toast(
          para === "yo" ? `⏰ Te recuerdo el ${cuandoTxt}`
          : para === "responsable" ? `⏰ Le avisamos a ${nombreOtro} el ${cuandoTxt}`
          : `⏰ Les avisamos a ambos el ${cuandoTxt}`,
        );
      }
      router.refresh();
    } catch {
      toast("⚠️ Error de conexión");
    } finally { setGuardando(false); }
  };

  const quitar = async () => {
    setGuardando(true);
    try {
      const r = await fetch("/api/admin/tarea-recordatorio", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        // "ambos" quita el mío y el que YO le puse; el suyo propio nunca se toca.
        body: JSON.stringify({ tarea_id: tareaId, para: duenoOtro ? "ambos" : "yo" }),
      });
      if (!r.ok) { toast("⚠️ No se pudo quitar"); return; }
      setLocal(null);
      setAbierto(false);
      toast("Recordatorio quitado");
      router.refresh();
    } catch {
      toast("⚠️ Error de conexión");
    } finally { setGuardando(false); }
  };

  if (!abierto) {
    return (
      <div className="mb-3">
        {local ? (
          <div className="flex items-center gap-2 flex-wrap rounded-lg border border-amber-400/25 bg-amber-500/[0.06] px-2.5 py-2">
            <Bell size={13} className={local.enviado_at ? "text-white/35" : "text-amber-300"} />
            <span className="text-xs text-white/80">
              {local.enviado_at ? "Te avisé el" : "Te recuerdo el"} {fechaLarga(local.recordar_at)}
            </span>
            {local.nota && <span className="text-[11px] text-white/40 truncate max-w-full">· {local.nota}</span>}
            <button onClick={() => setAbierto(true)} className="ml-auto text-[11px] text-white/50 hover:text-white cursor-pointer">Cambiar</button>
            <button onClick={quitar} disabled={guardando} title="Quitar recordatorio"
              className="text-white/30 hover:text-red-300 disabled:opacity-40 cursor-pointer"><BellOff size={13} /></button>
          </div>
        ) : (
          <button onClick={() => setAbierto(true)}
            className="flex items-center gap-1.5 text-xs text-white/45 hover:text-white cursor-pointer">
            <Bell size={13} /> Recuérdamelo…
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
      <label className={lblS}>
        Recuérdamelo <span className="text-white/25">(push + correo)</span>
      </label>
      <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} className={`${inp} mb-2`} />
      <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200}
        placeholder={para === "yo" ? "Nota para tu yo del futuro (opcional)" : `Nota para ${nombreOtro} (opcional)`}
        className={`${inp} mb-2`} />

      {/* Solo aparece cuando la tarea es de alguien más: si es mía, las tres
          opciones dirían lo mismo. */}
      {duenoOtro && (
        <div className="mb-2">
          <p className="text-white/35 text-[11px] mb-1.5">Esta tarea es de {duenoOtro.nombre}. ¿A quién le aviso?</p>
          <div className="flex flex-wrap gap-1.5">
            {([
              ["yo", "Solo a mí"],
              ["responsable", `Solo a ${nombreOtro}`],
              ["ambos", "A los dos"],
            ] as const).map(([v, lbl]) => (
              <button key={v} type="button" onClick={() => setPara(v)}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer ${
                  para === v ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"
                }`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={guardar} disabled={guardando || !cuando}
          className="flex items-center gap-1.5 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />} Guardar
        </button>
        <button onClick={() => setAbierto(false)} className="text-white/40 hover:text-white text-xs px-2 py-1.5 cursor-pointer">Cancelar</button>
        {local && (
          <button onClick={quitar} disabled={guardando} className="ml-auto text-white/35 hover:text-red-300 text-xs px-2 py-1.5 cursor-pointer">Quitar</button>
        )}
      </div>
    </div>
  );
}
