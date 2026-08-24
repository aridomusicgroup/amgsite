"use client";
import { useState, useMemo, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, ChevronDown, GripVertical, Eye, EyeOff, Check, Trash2, Pencil, CalendarClock, CircleDollarSign, CalendarDays, LayoutGrid, ChevronLeft, ChevronRight, MoreHorizontal, Hourglass, Bell, BellOff } from "lucide-react";
import { DndContext, closestCenter, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ESTADOS_PROY, ESTADO_PROY_LABEL, TIPO_PROY_LABEL, PRIORIDAD_LABEL,
  type Proyecto, type ProyectoTarea,
} from "@/lib/erp-data";
import { toast } from "@/lib/toast";
import { InstrumentosPicker } from "@/components/admin/InstrumentosPicker";
import { fechaLarga, soloHora, paraInput, sugerenciaInicial, estaVencido, type MiRecordatorio } from "@/lib/recordatorios";
import { estaAtrasado } from "@/lib/vencimientos";
import { useDestacar } from "@/lib/useDestacar";
import { diag } from "@/lib/diag";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const hoy = () => new Date().toISOString().slice(0, 10);
const fechaCorta = (s: string | null) =>
  s ? new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : null;

const ESTADO_COLOR: Record<string, string> = {
  cola: "bg-white/10 text-white/60",
  produccion: "bg-amber-500/15 text-amber-300",
  revision: "bg-purple-500/15 text-purple-300",
  entregado: "bg-blue-500/15 text-blue-300",
  cerrado: "bg-green-500/15 text-green-300",
  pausado: "bg-white/5 text-white/40",
  cancelado: "bg-white/5 text-white/35",
};
const PRIOR_DOT: Record<string, string> = { alta: "bg-red-400", media: "bg-amber-400", baja: "bg-white/30" };
const PRIOR_ORDER: Record<string, number> = { alta: 0, media: 1, baja: 2 };

// Antigüedad de un proyecto abierto: días desde que arrancó el reloj. El reloj
// del cliente arranca con la VENTA; si el proyecto no tiene venta ligada (tareas
// internas, contenido) se usa su fecha de creación. Mismo criterio que la
// pestaña Entregas del Dashboard (lib/entregas.ts).
const EDAD_ALERTA = 21;   // rojo: más de 3 semanas abierto
const EDAD_AVISO = 14;    // ámbar: más de 2 semanas
export function edadDe(p: { fechaVenta: string | null; creado: string }): number | null {
  const inicio = p.fechaVenta || p.creado;
  if (!inicio) return null;
  const d = Math.round((Date.now() - new Date(inicio + "T12:00:00").getTime()) / 86400000);
  return Math.max(0, d);
}
const COLS_BASE = ["cola", "produccion", "revision", "entregado"];
const COLS_FIN = ["cerrado", "pausado", "cancelado"];
const TIPOS_PROD = ["beat_personalizado", "bp_letra", "grabacion", "mezcla_master", "ep", "album", "beat", "creacion_contenido"];
const TIPOS_INT = ["contenido", "creacion_contenido", "distribucion", "admin"];
const TIPOS_CONTENIDO = ["creacion_contenido", "contenido", "beat"];
const esContenido = (tipo: string | null) => !!tipo && TIPOS_CONTENIDO.includes(tipo);
// Campos de publicación (plataforma / fecha de publicación / link del post) SOLO para Creación de contenido (no Beat).
const esContenidoPub = (tipo: string | null) => tipo === "creacion_contenido" || tipo === "contenido";
const PLATAFORMAS = ["Instagram", "TikTok", "YouTube", "Facebook", "Spotify", "Otro"];

const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red w-full";
const lblS = "block text-[10px] text-white/40 mb-1";

type Equipo = { id: string; nombre: string };
type Cliente = { nombre: string; email: string | null; telefono: string | null };
type VentaLite = { id: string; label: string };

const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

export function ProduccionBoard({ proyectos, equipo, clientes, ventas, isAdmin, defaultResp = "todos", recordatorios = {}, miId = null }: {
  proyectos: Proyecto[]; equipo: Equipo[]; clientes: Cliente[]; ventas: VentaLite[]; isAdmin: boolean; defaultResp?: string;
  /** MIS recordatorios (los de quien tiene la sesión abierta), por tarea. */
  recordatorios?: Record<string, MiRecordatorio>;
  /** Mi ficha del equipo: sirve para saber si una tarea ya es mía. */
  miId?: string | null;
}) {
  const [q, setQ] = useState("");
  const [clase, setClase] = useState("todos");
  const [resp, setResp] = useState(defaultResp);
  const [tipoF, setTipoF] = useState("todos");
  const [verFin, setVerFin] = useState(false);
  const [creando, setCreando] = useState(false);
  const [vista, setVista] = useState<"tablero" | "calendario">("tablero");
  const [foco, setFoco] = useState<"todos" | "atrasados" | "semana">("todos");
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  // Si llegas desde una notificación, el tablero nace filtrado: ?buscar=FOLIO
  // abre ese proyecto, ?foco=atrasados|semana abre la lista que te avisó.
  const destacado = useDestacar();
  useEffect(() => {
    diag("tablero MONTADO (hidratacion lista)");
    const sp = new URLSearchParams(window.location.search);
    const b = sp.get("buscar");
    if (b) setQ(b);
    const f = sp.get("foco");
    if (f === "atrasados" || f === "semana") setFoco(f);
  }, []);

  // Estado optimista al arrastrar un proyecto entre columnas: se mueve al
  // instante y se guarda en segundo plano. Se reconcilia cuando el server
  // confirma (o si otro usuario lo movió por tiempo real).
  const [estadoLocal, setEstadoLocal] = useState<Record<string, string>>({});
  const router = useRouter();

  // Al llegar datos frescos, suelta los overrides que el server ya refleja
  // (mantiene los que aún no aterció para no "regresar" la tarjeta).
  useEffect(() => {
    setEstadoLocal((prev) => {
      const next: Record<string, string> = {};
      for (const id of Object.keys(prev)) {
        const p = proyectos.find((x) => x.id === id);
        if (p && p.estado !== prev[id]) next[id] = prev[id];
      }
      return next;
    });
  }, [proyectos]);

  const proyectosView = useMemo(
    () => proyectos.map((p) => (p.id in estadoLocal ? { ...p, estado: estadoLocal[p.id] } : p)),
    [proyectos, estadoLocal],
  );

  // El tiempo real del tablero lo cubre la suscripción global en AdminNav
  // (rt-panel), presente en todas las páginas del admin.

  // Mover un proyecto de etapa (drag & drop entre columnas). Optimista: la
  // tarjeta salta de columna al instante y se guarda en segundo plano.
  const moverProyecto = async (id: string, estado: string) => {
    const pr = proyectosView.find((x) => x.id === id);
    if (!pr || pr.estado === estado) return;
    setEstadoLocal((s) => ({ ...s, [id]: estado })); // instantáneo
    toast(`→ ${ESTADO_PROY_LABEL[estado]}`);
    try {
      const r = await fetch("/api/admin/proyectos", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, estado }),
      });
      if (!r.ok) throw new Error();
      router.refresh(); // reconcilia (el override se libera al llegar los datos)
    } catch {
      setEstadoLocal((s) => { const n = { ...s }; delete n[id]; return n; }); // revierte
      toast("⚠️ No se pudo mover el proyecto");
    }
  };

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return proyectosView.filter((p) => {
      if (clase !== "todos" && p.clase !== clase) return false;
      if (tipoF !== "todos" && p.tipo !== tipoF) return false;
      if (resp !== "todos" && !p.responsables.includes(resp) && p.responsable_id !== resp && !p.tareas.some((t) => t.responsable_id === resp)) return false;
      if (!term) return true;
      return (
        p.titulo.toLowerCase().includes(term) ||
        (p.contacto ?? "").toLowerCase().includes(term) ||
        (p.responsable ?? "").toLowerCase().includes(term) ||
        (p.folio ?? "").toLowerCase().includes(term)
      );
    });
  }, [proyectosView, q, clase, resp, tipoF]);

  const tiposDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const p of proyectos) if (p.tipo) set.add(p.tipo);
    return [...set].sort((a, b) => (TIPO_PROY_LABEL[a] ?? a).localeCompare(TIPO_PROY_LABEL[b] ?? b));
  }, [proyectos]);

  const cols = verFin ? [...COLS_BASE, ...COLS_FIN] : COLS_BASE;

  // KPIs
  const activos = list.filter((p) => !["cerrado", "cancelado"].includes(p.estado));
  // Misma regla que el aviso push de las mañanas (lib/vencimientos.ts): si el
  // tablero dijera 8 y la notificación 6, nadie sabría a cuál hacerle caso.
  const overdue = (p: Proyecto) => estaAtrasado(p.fecha_entrega, p.estado);
  const enSemana = (p: Proyecto) => {
    if (!p.fecha_entrega || ["entregado", "cerrado", "cancelado"].includes(p.estado)) return false;
    const d = (new Date(p.fecha_entrega + "T12:00:00").getTime() - Date.now()) / 86400000;
    return d >= 0 && d <= 7;
  };
  // Antigüedad: días desde que arrancó el reloj (la venta si hay, si no la creación).
  const masViejo = activos
    .filter((p) => p.estado !== "entregado")   // ya entregado = el reloj paró
    .reduce<{ p: Proyecto; edad: number } | null>((acc, p) => {
      const e = edadDe(p);
      return e !== null && (!acc || e > acc.edad) ? { p, edad: e } : acc;
    }, null);

  const kpis = [
    { label: "Activos", value: String(activos.length) },
    { label: "En producción", value: String(list.filter((p) => p.estado === "produccion").length) },
    { label: "Por entregar (7d)", value: String(activos.filter(enSemana).length) },
    { label: "Atrasados", value: String(activos.filter(overdue).length), amber: activos.some(overdue) },
    {
      label: masViejo ? `Más viejo: ${masViejo.p.titulo.slice(0, 18)}` : "Más viejo en curso",
      value: masViejo ? `${masViejo.edad}d` : "—",
      amber: !!masViejo && masViejo.edad >= EDAD_ALERTA,
    },
    ...(isAdmin ? [{ label: "Por cobrar", value: peso(list.reduce((a, p) => a + p.ventaSaldo, 0)) }] : []),
  ];

  // Foco rápido (atrasados / esta semana) aplicado a lo que se muestra
  const listaVista = foco === "atrasados" ? list.filter(overdue) : foco === "semana" ? list.filter(enSemana) : list;

  // Llegando con ?destacar=, los filtros se tocan SOLO si hace falta.
  //
  // Antes se abrían de par en par siempre, y eso te tiraba tu filtro de "mis
  // proyectos" cada vez que llegaba una notificación — perder tu vista de
  // trabajo es peor que el problema que resolvía. Ahora primero se mira: si lo
  // que te avisaron ya se ve con TUS filtros, no se toca nada. Solo cuando está
  // escondido (es de otra persona, o ya está entregado y esas columnas no se
  // muestran) se abren, porque si no aterrizas en una lista vacía.
  //
  // `listaVista` a propósito NO va en las dependencias: la decisión se toma una
  // vez, en el momento en que llega el aviso.
  useEffect(() => {
    if (!destacado) return;
    const seVe = listaVista.some(
      (p) => p.id === destacado || p.tareas.some((t) => t.id === destacado),
    );
    diag(`filtros: el destacado ${seVe ? "YA se ve (no se tocan)" : "estaba escondido (se abren)"}`);
    if (seVe) return;
    setResp("todos"); setClase("todos"); setTipoF("todos"); setFoco("todos"); setVerFin(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destacado]);
  const ordenarCol = (arr: Proyecto[]) =>
    [...arr].sort((a, b) =>
      (PRIOR_ORDER[a.prioridad] ?? 1) - (PRIOR_ORDER[b.prioridad] ?? 1) ||
      (a.fecha_entrega ?? "9999").localeCompare(b.fecha_entrega ?? "9999"));

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs transition-colors ${active ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`;

  return (
    <div>
      {/* Datalist compartido para ligar una venta existente a un proyecto */}
      <datalist id="ventas-link-list">
        {ventas.map((v) => <option key={v.id} value={v.label} />)}
      </datalist>
      <datalist id="plataformas-list">{PLATAFORMAS.map((p) => <option key={p} value={p} />)}</datalist>

      {/* KPIs */}
      <div className={`grid grid-cols-2 gap-3 mb-5 ${isAdmin ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
        {kpis.map((k) => (
          <div key={k.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-3.5">
            <p className={`text-xl font-coolvetica ${k.amber ? "text-amber-300" : ""}`}>{k.value}</p>
            <p className="text-white/40 text-[11px] mt-0.5 truncate" title={k.label}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros + Nuevo */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red flex-1 min-w-[160px]" />
        <button onClick={() => setClase("todos")} className={chip(clase === "todos")}>Todo</button>
        <button onClick={() => setClase("produccion")} className={chip(clase === "produccion")}>Producciones</button>
        <button onClick={() => setClase("interna")} className={chip(clase === "interna")}>Tareas</button>
        <button onClick={() => setFoco((v) => (v === "atrasados" ? "todos" : "atrasados"))} className={chip(foco === "atrasados")}>Atrasados</button>
        <button onClick={() => setFoco((v) => (v === "semana" ? "todos" : "semana"))} className={chip(foco === "semana")}>Esta semana</button>
        <select value={resp} onChange={(e) => setResp(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lgb-red">
          <option value="todos" className="bg-lgb-dark">Todos los responsables</option>
          {equipo.map((e) => <option key={e.id} value={e.id} className="bg-lgb-dark">{e.nombre}</option>)}
        </select>
        <select value={tipoF} onChange={(e) => setTipoF(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lgb-red">
          <option value="todos" className="bg-lgb-dark">Todos los tipos</option>
          {tiposDisponibles.map((t) => <option key={t} value={t} className="bg-lgb-dark">{TIPO_PROY_LABEL[t] ?? t}</option>)}
        </select>
        <button onClick={() => setVerFin((v) => !v)} className={chip(verFin)}>Ver terminados</button>
        <div className="flex items-center gap-0.5 bg-white/5 rounded-full p-0.5 ml-auto">
          <button onClick={() => setVista("tablero")} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${vista === "tablero" ? "bg-lgb-red text-white" : "text-white/50 hover:text-white"}`}><LayoutGrid size={13} /> Tablero</button>
          <button onClick={() => setVista("calendario")} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${vista === "calendario" ? "bg-lgb-red text-white" : "text-white/50 hover:text-white"}`}><CalendarDays size={13} /> Calendario</button>
        </div>
        <button onClick={() => setCreando((v) => !v)}
          className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-red-700">
          <Plus size={15} /> Nuevo
        </button>
      </div>

      {creando && <NuevoProyecto equipo={equipo} clientes={clientes} onClose={() => setCreando(false)} />}

      {vista === "calendario" ? (
        <CalendarioProduccion proyectos={listaVista} resp={resp} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {cols.map((estado) => {
            const items = ordenarCol(listaVista.filter((p) => p.estado === estado));
            return (
              <div key={estado}
                onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== estado) setDragOverCol(estado); }}
                onDragLeave={() => setDragOverCol((c) => (c === estado ? null : c))}
                onDrop={(e) => { e.preventDefault(); setDragOverCol(null); const id = e.dataTransfer.getData("text/plain"); if (id) moverProyecto(id, estado); }}
                className={`shrink-0 w-72 rounded-xl p-1 transition-colors ${dragOverCol === estado ? "bg-lgb-red/5 ring-1 ring-lgb-red/30" : ""}`}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[estado]}`}>{ESTADO_PROY_LABEL[estado]}</span>
                  <span className="text-white/30 text-xs">{items.length}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((p) => (
                    <ProyectoCard key={p.id} p={p} equipo={equipo} ventas={ventas} isAdmin={isAdmin} overdue={overdue(p)} recordatorios={recordatorios} destacado={destacado} miId={miId} />
                  ))}
                  {items.length === 0 && <p className="text-white/20 text-xs text-center py-6 border border-dashed border-white/8 rounded-xl">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {listaVista.length === 0 && (
        <p className="text-white/40 text-sm text-center py-10">
          {foco === "atrasados" ? "🎉 Nada atrasado, todo al día." : foco === "semana" ? "Nada por entregar esta semana." : "Aún no hay proyectos. Crea el primero con “Nuevo” ↗"}
        </p>
      )}
    </div>
  );
}

// ── Vista de calendario (proyectos y tareas por fecha) ────────────────────────
type CalEv = { key: string; fecha: string; titulo: string; tarea: boolean; hecho?: boolean; responsable: string | null; tipo: string | null; plataforma: string | null };

function CalendarioProduccion({ proyectos, resp }: { proyectos: Proyecto[]; resp: string }) {
  const hoyD = new Date();
  const [ref, setRef] = useState({ y: hoyD.getFullYear(), m: hoyD.getMonth() });
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const dateOf = (p: Proyecto) => (esContenidoPub(p.tipo) ? p.fecha_publicacion : p.fecha_entrega);

  const eventos = useMemo(() => {
    const out: CalEv[] = [];
    for (const p of proyectos) {
      const pd = dateOf(p);
      if (pd && (resp === "todos" || p.responsables.includes(resp) || p.responsable_id === resp)) {
        out.push({ key: "p" + p.id, fecha: pd, titulo: p.titulo, tarea: false, responsable: p.responsable, tipo: p.tipo, plataforma: p.plataforma });
      }
      for (const t of p.tareas) {
        if (t.fecha && (resp === "todos" || t.responsable_id === resp)) {
          out.push({ key: "t" + t.id, fecha: t.fecha, titulo: t.titulo, tarea: true, hecho: t.hecho, responsable: t.responsable, tipo: p.tipo, plataforma: null });
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectos, resp]);

  const porFecha = useMemo(() => {
    const map = new Map<string, CalEv[]>();
    for (const e of eventos) { const arr = map.get(e.fecha) ?? []; arr.push(e); map.set(e.fecha, arr); }
    return map;
  }, [eventos]);

  const hoyStr = hoyD.toISOString().slice(0, 10);
  const en7 = new Date(hoyD.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const semana = eventos.filter((e) => e.fecha >= hoyStr && e.fecha <= en7).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const first = new Date(ref.y, ref.m, 1);
  const daysInMonth = new Date(ref.y, ref.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const iso = (day: number) => `${ref.y}-${String(ref.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const mesNombre = first.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const prev = () => setRef((r) => { const d = new Date(r.y, r.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const next = () => setRef((r) => { const d = new Date(r.y, r.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const dow = ["D", "L", "M", "M", "J", "V", "S"];
  const chipCls = (e: CalEv) => e.tarea
    ? (e.hecho ? "bg-white/5 text-white/30 line-through" : "bg-white/10 text-white/70")
    : (esContenido(e.tipo) ? "bg-pink-500/15 text-pink-200" : "bg-lgb-red/15 text-red-200");

  return (
    <div>
      {semana.length > 0 && (
        <div className="mb-4 rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Esta semana · {semana.length}</p>
          <div className="flex flex-col gap-1.5">
            {semana.slice(0, 10).map((e) => (
              <div key={e.key} className="flex items-center gap-2 text-xs">
                <span className="text-white/40 w-12 shrink-0">{fechaCorta(e.fecha)}</span>
                <span className={`truncate flex-1 ${e.hecho ? "text-white/30 line-through" : "text-white/80"}`}>{e.tarea ? "• " : ""}{e.titulo}</span>
                {e.plataforma && <span className="px-1.5 rounded-full bg-pink-500/15 text-pink-300 text-[10px] shrink-0">{e.plataforma}</span>}
                {e.responsable && <span className="text-white/30 text-[10px] shrink-0">{e.responsable.split(" ")[0]}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5"><ChevronLeft size={18} /></button>
        <span className="font-coolvetica text-lg capitalize">{mesNombre}</span>
        <button onClick={next} className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dow.map((d, i) => <div key={i} className="text-center text-[10px] text-white/30 py-1">{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const ds = iso(day);
          const items = porFecha.get(ds) ?? [];
          const esHoy = ds === hoyStr;
          return (
            <div key={i} onClick={() => setDiaSel((d) => (d === ds ? null : ds))}
              className={`min-h-[74px] rounded-lg border p-1 cursor-pointer transition-colors ${diaSel === ds ? "border-lgb-red ring-1 ring-lgb-red/40" : esHoy ? "border-lgb-red/50 bg-lgb-red/5" : "border-white/8 bg-white/[0.02] hover:border-white/20"}`}>
              <p className={`text-[10px] mb-0.5 ${esHoy ? "text-lgb-red font-medium" : "text-white/40"}`}>{day}</p>
              <div className="flex flex-col gap-0.5">
                {items.slice(0, 3).map((e) => (
                  <span key={e.key} title={`${e.titulo}${e.responsable ? " · " + e.responsable : ""}`}
                    className={`text-[9px] px-1 py-0.5 rounded truncate ${chipCls(e)}`}>
                    {e.tarea ? "• " : ""}{e.titulo}
                  </span>
                ))}
                {items.length > 3 && <span className="text-[9px] text-white/30 pl-1">+{items.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {diaSel && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium capitalize">{new Date(diaSel + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</p>
            <button onClick={() => setDiaSel(null)} className="text-white/40 hover:text-white"><X size={16} /></button>
          </div>
          {(porFecha.get(diaSel) ?? []).length === 0 ? (
            <p className="text-white/30 text-sm">Nada agendado este día.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(porFecha.get(diaSel) ?? []).map((e) => (
                <div key={e.key} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${e.tarea ? "bg-white/40" : esContenido(e.tipo) ? "bg-pink-400" : "bg-lgb-red"}`} />
                  <span className={`flex-1 truncate ${e.hecho ? "text-white/30 line-through" : "text-white/80"}`}>{e.titulo}</span>
                  <span className="text-white/30 text-[10px]">{e.tarea ? "tarea" : "proyecto"}</span>
                  {e.plataforma && <span className="px-1.5 rounded-full bg-pink-500/15 text-pink-300 text-[10px]">{e.plataforma}</span>}
                  {e.responsable && <span className="text-white/40 text-xs">{e.responsable.split(" ")[0]}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="text-white/30 text-[11px] mt-3">📅 Proyectos (por publicación/entrega) y tareas (•) con fecha. Toca un día para ver el detalle. Para editar, ve al Tablero.</p>
    </div>
  );
}

// ── Fila de tarea arrastrable (dnd-kit); el handle son los 6 puntitos ─────────
function SortableTarea({ id, children }: {
  id: string;
  children: (h: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
    setActivatorNodeRef: ReturnType<typeof useSortable>["setActivatorNodeRef"];
  }) => ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "rounded-lg bg-white/[0.06]" : undefined}>
      {children({ attributes, listeners, setActivatorNodeRef })}
    </div>
  );
}

// ── Tarjeta de proyecto ───────────────────────────────────────────────────────
function ProyectoCard({ p, equipo, ventas, isAdmin, overdue, recordatorios, destacado, miId }: {
  p: Proyecto; equipo: Equipo[]; ventas: VentaLite[]; isAdmin: boolean; overdue: boolean;
  recordatorios: Record<string, MiRecordatorio>;
  miId: string | null;
  /** Id (de proyecto o de tarea) al que hay que llevar a la persona, si llegó desde un aviso. */
  destacado: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [nuevaTareaResp, setNuevaTareaResp] = useState("");
  const [modalTareaId, setModalTareaId] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [pf, setPf] = useState({ fecha: hoy(), monto: "", medio: "" });
  const [ef, setEf] = useState({
    titulo: p.titulo, clase: p.clase, tipo: p.tipo ?? "", responsable_id: p.responsable_id ?? "", responsables: p.responsables ?? [],
    prioridad: p.prioridad, fecha_entrega: p.fecha_entrega ?? "", brief: p.brief ?? "",
    entregable_url: p.entregable_url ?? "", notas: p.notas ?? "", venta_id: p.venta_id ?? "",
    plataforma: p.plataforma ?? "", fecha_publicacion: p.fecha_publicacion ?? "", link_post: p.link_post ?? "",
  });
  const [ventaInput, setVentaInput] = useState(ventas.find((v) => v.id === p.venta_id)?.label ?? "");
  const onVenta = (val: string) => {
    setVentaInput(val);
    const m = ventas.find((v) => v.label === val);
    setEf((s) => ({ ...s, venta_id: m ? m.id : "" }));
  };

  const [optDone, setOptDone] = useState<Record<string, boolean>>({});
  const [optVisible, setOptVisible] = useState<Record<string, boolean>>({});
  useEffect(() => { setOptVisible({}); }, [p.tareas]); // reconcilia con datos frescos
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskDone = (t: ProyectoTarea) => (t.id in optDone ? optDone[t.id] : t.hecho);
  const visibleOf = (t: ProyectoTarea) => (t.id in optVisible ? optVisible[t.id] : t.visible_cliente);
  const hechas = p.tareas.filter(taskDone).length;
  const fEntrega = fechaCorta(p.fecha_entrega);
  // Solo tiene sentido para lo que sigue abierto: lo entregado ya paró el reloj.
  const edad = ["entregado", "cerrado", "cancelado"].includes(p.estado) ? null : edadDe(p);

  // Orden optimista de tareas: al arrastrar se refleja al instante y se guarda en
  // segundo plano; cuando el server vuelve a mandar datos, se reconcilia.
  const [ordenLocal, setOrdenLocal] = useState<string[] | null>(null);
  useEffect(() => { setOrdenLocal(null); }, [p.tareas]);
  const tareas = ordenLocal
    ? (ordenLocal.map((id) => p.tareas.find((t) => t.id === id)).filter(Boolean) as ProyectoTarea[])
    : p.tareas;

  // Arrastre de tareas (dnd-kit). Mientras se arrastra una tarea, se desactiva el
  // arrastre nativo de la tarjeta para que no se muevan las dos cosas a la vez.
  // Ratón: arranca al mover 5px. Táctil (iPad): mantén presionado ~180ms y
  // arrastra (así el scroll normal sigue funcionando). Estilo Notion móvil.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const onDragEndTarea = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || activeId === overId) return;
    const ids = tareas.map((t) => t.id);
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const nuevo = arrayMove(ids, from, to);
    setOrdenLocal(nuevo); // instantáneo
    fetch("/api/admin/proyecto-tareas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orden_ids: nuevo }) })
      .catch(() => toast("⚠️ No se pudo guardar el orden"));
  };

  const api = async (method: string, body: Record<string, unknown>, url = "/api/admin/proyectos") => {
    setBusy(true);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.ok) router.refresh();
      return r.ok;
    } catch { return false; }
    finally { setBusy(false); }
  };

  const mover = (estado: string) => api("PATCH", { id: p.id, estado });
  const nuevaRonda = async () => {
    if (await api("PATCH", { id: p.id, nueva_ronda: true })) toast(`🔄 Ronda de revisión ${p.revisionActual + 1}`);
  };
  const guardarEdit = async () => { if (await api("PATCH", { id: p.id, ...ef })) { setEditing(false); toast("✓ Guardado"); } };
  const borrar = async () => { if (await api("DELETE", { id: p.id })) { setConfirming(false); toast("✓ Eliminado"); } };
  const toggleTarea = (t: ProyectoTarea) => {
    const nuevo = !taskDone(t);
    setOptDone((o) => ({ ...o, [t.id]: nuevo })); // UI optimista: se voltea al instante
    fetch("/api/admin/proyecto-tareas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, hecho: nuevo }) })
      .then((r) => {
        if (!r.ok) throw new Error();
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 900); // reconcilia progreso sin bloquear los clics rápidos
      })
      .catch(() => { setOptDone((o) => ({ ...o, [t.id]: !nuevo })); toast("⚠️ No se pudo guardar"); });
  };
  const borrarTarea = (t: ProyectoTarea) => api("DELETE", { id: t.id }, "/api/admin/proyecto-tareas");
  const toggleVisible = (t: ProyectoTarea) => {
    const nuevo = !visibleOf(t);
    setOptVisible((o) => ({ ...o, [t.id]: nuevo })); // el ojito cambia al instante
    toast(nuevo ? "Visible al cliente" : "Oculta al cliente");
    fetch("/api/admin/proyecto-tareas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, visible_cliente: nuevo }) })
      .then((r) => { if (!r.ok) throw new Error(); })
      .catch(() => { setOptVisible((o) => ({ ...o, [t.id]: !nuevo })); toast("⚠️ No se pudo guardar"); });
  };
  const addTarea = async () => {
    const titulo = nuevaTarea.trim();
    if (!titulo) return;
    if (await api("POST", { proyecto_id: p.id, titulo, responsable_id: nuevaTareaResp || null }, "/api/admin/proyecto-tareas")) setNuevaTarea("");
  };
  const modalTarea = modalTareaId ? p.tareas.find((t) => t.id === modalTareaId) ?? null : null;

  // Llegaste aquí desde un aviso: la tarjeta se despliega sola para que la tarea
  // quede a la vista, resaltada y EN SU CONTEXTO.
  //
  // A propósito NO se abre su ventana: llegar de una notificación y aterrizar
  // dentro de un modal te tapa el proyecto y no te deja ver de qué venía. Se te
  // ubica dónde está; abrirla es tu decisión, a un toque.
  const esteProyecto = destacado === p.id;
  const tareaDestacada = destacado && p.tareas.some((t) => t.id === destacado) ? destacado : null;
  useEffect(() => {
    if (!esteProyecto && !tareaDestacada) return;
    setOpen(true);
  }, [esteProyecto, tareaDestacada]);
  const registrarPago = async () => {
    if (!(Number(pf.monto) > 0)) return;
    if (await api("POST", { venta_id: p.venta_id, fecha: pf.fecha, monto_mxn: pf.monto, medio_pago: pf.medio }, "/api/admin/pagos")) setPaying(false);
  };

  return (
    <div
      data-destacar-id={p.id}
      className={`rounded-xl border bg-white/[0.03] ${open || editing || confirming ? "border-lgb-red/40" : "border-white/8"} ${esteProyecto ? "arido-destacado" : ""}`}>
      <div className="p-3 cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", p.id); e.dataTransfer.effectAllowed = "move"; }}>
        <div className="flex items-start gap-2">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${PRIOR_DOT[p.prioridad] ?? "bg-white/30"}`} title={`Prioridad ${PRIORIDAD_LABEL[p.prioridad]}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight">{p.titulo}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] text-white/40">
              {p.clase === "interna"
                ? <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-white/50">{p.tipo ? (TIPO_PROY_LABEL[p.tipo] ?? p.tipo) : "Tarea"}</span>
                : p.tipo && <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-white/50">{TIPO_PROY_LABEL[p.tipo] ?? p.tipo}</span>}
              {p.contacto && <span>· {p.contacto}</span>}
            </div>
          </div>
          <button onClick={() => setOpen((o) => !o)} className="text-white/30 hover:text-white shrink-0">
            <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px]">
          {p.responsablesNombres.length > 0 && <span className="text-white/50">{p.responsablesNombres.map((n) => n.split(" ")[0]).join(" · ")}</span>}
          {isAdmin && p.ventaSaldo > 0.5 && <span className="text-amber-300 flex items-center gap-0.5"><CircleDollarSign size={11} /> {peso(p.ventaSaldo)}</span>}
          {fEntrega && <span className={`flex items-center gap-0.5 ${overdue ? "text-red-400" : "text-white/40"}`}><CalendarClock size={11} /> {fEntrega}</span>}
          {edad !== null && (
            <span
              className={`flex items-center gap-0.5 ${edad >= EDAD_ALERTA ? "text-red-400" : edad >= EDAD_AVISO ? "text-amber-300" : "text-white/40"}`}
              title={`Lleva ${edad} días abierto ${p.fechaVenta ? "desde la venta" : "desde que se creó"}`}
            >
              <Hourglass size={11} /> {edad}d
            </span>
          )}
          {p.tareas.length > 0 && <span className="text-white/40">✓ {hechas}/{p.tareas.length}</span>}
          {p.revisionActual > 0 && (
            <span className="text-amber-300 flex items-center gap-0.5" title={`Ronda de revisión ${p.revisionActual}`}>
              🔄 Rev {p.revisionActual} · {p.tareas.filter((t) => t.revision === p.revisionActual).length} cambios
            </span>
          )}
        </div>

        {p.tareas.length > 0 && (
          <div className="flex items-center gap-2 mt-1.5" title={`Avance: ${p.progreso}%`}>
            <div className="h-1.5 flex-1 rounded-full bg-white/8 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${p.progreso === 100 ? "bg-green-400" : "bg-lgb-red"}`} style={{ width: `${p.progreso}%` }} />
            </div>
            <span className="text-[10px] text-white/50 shrink-0 tabular-nums">{p.progreso}%</span>
          </div>
        )}

        <select value={p.estado} disabled={busy} onChange={(e) => mover(e.target.value)}
          className={`mt-2 w-full text-[11px] rounded-lg border-0 px-2 py-1 cursor-pointer focus:outline-none ${ESTADO_COLOR[p.estado]}`}>
          {ESTADOS_PROY.map((s) => <option key={s} value={s} className="bg-lgb-dark text-white">{ESTADO_PROY_LABEL[s]}</option>)}
        </select>
      </div>

      {open && !editing && (
        <div className="border-t border-white/8 px-3 py-3 space-y-2.5">
          {p.clase === "produccion" && !esContenido(p.tipo) && p.estado === "revision" && (
            <button onClick={nuevaRonda} disabled={busy}
              className="flex items-center gap-1.5 text-[11px] text-amber-300/90 hover:text-amber-200 border border-amber-400/25 hover:border-amber-400/50 rounded-lg px-2.5 py-1 disabled:opacity-50">
              🔄 {p.revisionActual === 0 ? "Abrir ronda de revisión" : `Nueva ronda de revisión (R${p.revisionActual + 1})`}
            </button>
          )}
          {p.brief && (
            <p className="text-xs text-white/60 break-words">
              <span className="text-white/30">Brief:</span>{" "}
              {/^https?:\/\//i.test(p.brief) ? (
                <a href={p.brief} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline break-all">{p.brief}</a>
              ) : p.brief}
            </p>
          )}
          {isAdmin && p.ventaTotal > 0 && (
            <p className="text-xs text-white/60">
              <span className="text-white/30">Dinero:</span> {peso(p.ventaTotal)}
              {p.ventaSaldo > 0.5 ? <span className="text-amber-300"> · saldo {peso(p.ventaSaldo)}</span> : <span className="text-green-300"> · pagado</span>}
            </p>
          )}
          {isAdmin && p.venta_id && p.ventaSaldo > 0.5 && (
            paying ? (
              <div className="flex flex-wrap items-end gap-1.5">
                <input type="date" value={pf.fecha} onChange={(e) => setPf((s) => ({ ...s, fecha: e.target.value }))} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-lgb-red" />
                <input type="number" step="any" value={pf.monto} onChange={(e) => setPf((s) => ({ ...s, monto: e.target.value }))} placeholder="monto" className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-20 focus:outline-none focus:ring-1 focus:ring-lgb-red" />
                <input value={pf.medio} onChange={(e) => setPf((s) => ({ ...s, medio: e.target.value }))} placeholder="medio" className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-20 focus:outline-none focus:ring-1 focus:ring-lgb-red" />
                <button onClick={registrarPago} disabled={busy} className="bg-lgb-red text-white px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50">Guardar</button>
                <button onClick={() => setPaying(false)} className="text-white/40 text-xs px-1">✕</button>
              </div>
            ) : (
              <button onClick={() => { setPaying(true); setPf({ fecha: hoy(), monto: String(Math.round(p.ventaSaldo)), medio: "" }); }}
                className="flex items-center gap-1 text-[11px] text-lgb-red hover:underline">
                <CircleDollarSign size={12} /> Registrar pago
              </button>
            )
          )}
          {p.entregable_url && (
            <a href={p.entregable_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-300 hover:underline break-all">📁 Entregables</a>
          )}
          {p.drive_folder_id && (
            <a href={`https://drive.google.com/drive/folders/${p.drive_folder_id}`} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-300 hover:underline break-all">📂 Archivos del cliente (Drive)</a>
          )}
          {esContenidoPub(p.tipo) && (p.plataforma || p.fecha_publicacion || p.link_post) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {p.plataforma && <span className="px-1.5 py-0.5 rounded-full bg-pink-500/15 text-pink-300">{p.plataforma}</span>}
              {p.fecha_publicacion && <span className="text-white/50">📅 publica {fechaCorta(p.fecha_publicacion)}</span>}
              {p.link_post && <a href={p.link_post} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline">🔗 ver post</a>}
            </div>
          )}
          {p.metricas && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-white/55 bg-white/[0.03] border border-white/8 rounded-lg px-2.5 py-1.5">
              <span className="text-white/35">Métricas reales:</span>
              {p.metricas.reproducciones > 0 && <span title="Reproducciones">▶️ {p.metricas.reproducciones.toLocaleString("es-MX")}</span>}
              <span title="Me gusta">❤️ {p.metricas.likes.toLocaleString("es-MX")}</span>
              <span title="Comentarios">💬 {p.metricas.comentarios.toLocaleString("es-MX")}</span>
              {p.metricas.compartidos > 0 && <span title="Compartidos">🔁 {p.metricas.compartidos.toLocaleString("es-MX")}</span>}
              {p.metricas.guardados > 0 && <span title="Guardados">🔖 {p.metricas.guardados.toLocaleString("es-MX")}</span>}
            </div>
          )}
          {esContenidoPub(p.tipo) && p.link_post && !p.metricas && (
            <p className="text-[10px] text-white/25">Métricas: se ligan solas tras la sincronización de Analítica.</p>
          )}

          {/* Checklist */}
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Tareas</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndTarea}>
              <SortableContext items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {tareas.map((t) => {
                    const subDone = t.subtareas.filter((s) => s.hecho).length;
                    const esRev = t.revision > 0;
                    return (
                      <SortableTarea key={t.id} id={t.id}>
                        {(h) => (
                          <div data-destacar-id={t.id}
                            className={`flex items-center gap-1.5 group ${destacado === t.id ? "arido-destacado" : ""}`}>
                            {/* Gripcito: arrastra para reordenar (el orden que ve el cliente) */}
                            <span ref={h.setActivatorNodeRef} {...h.attributes} {...h.listeners}
                              title="Arrastra para reordenar"
                              className="touch-none cursor-grab active:cursor-grabbing text-white/25 hover:text-white/60 shrink-0 -ml-1 py-1 pr-1">
                              <GripVertical size={14} />
                            </span>
                            <button onClick={() => toggleTarea(t)}
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${taskDone(t) ? "bg-green-500/30 border-green-400/50" : "border-white/20"}`}>
                              {taskDone(t) && <Check size={11} className="text-green-300" />}
                            </button>
                            <button onClick={() => setModalTareaId(t.id)} className={`text-xs flex-1 text-left hover:text-white truncate ${taskDone(t) ? "text-white/30 line-through" : esRev ? "text-amber-300/90" : "text-white/70"}`}>
                              {esRev && <span className="text-[9px] font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 rounded-full px-1.5 mr-1 align-middle">R{t.revision}</span>}
                              {t.titulo}
                              {t.subtareas.length > 0 && <span className="text-white/30 ml-1">({subDone}/{t.subtareas.length})</span>}
                              {t.notas && <span className="text-white/25 ml-1">📝</span>}
                            </button>
                            {/* Mi campanita: solo la ve quien puso el recordatorio. */}
                            {recordatorios[t.id] && (
                              <span
                                title={`Te recuerdo el ${fechaLarga(recordatorios[t.id].recordar_at)}`}
                                className={`shrink-0 flex items-center gap-0.5 text-[9px] ${
                                  recordatorios[t.id].enviado_at ? "text-white/25" : estaVencido(recordatorios[t.id]) ? "text-red-300" : "text-amber-300"
                                }`}>
                                <Bell size={10} /> {soloHora(recordatorios[t.id].recordar_at)}
                              </span>
                            )}
                            {t.metricas && t.metricas.reproducciones > 0 && <span className="text-[9px] text-white/40 shrink-0" title="Reproducciones">▶️{t.metricas.reproducciones.toLocaleString("es-MX")}</span>}
                            {t.fecha && <span className={`text-[9px] shrink-0 ${!t.hecho && t.fecha < hoy() ? "text-red-300" : "text-white/30"}`}>{fechaCorta(t.fecha)}</span>}
                            {t.responsable && <span className="text-[9px] text-white/30 shrink-0">{t.responsable.split(" ")[0]}</span>}
                            {/* Visible al cliente (solo producciones reales, no beats de catálogo ni contenido) */}
                            {p.clase === "produccion" && !esContenido(p.tipo) && (
                              <button onClick={() => toggleVisible(t)} title={visibleOf(t) ? "Visible al cliente — clic para ocultar" : "Oculta al cliente — clic para mostrar"}
                                className={`shrink-0 ${visibleOf(t) ? "text-lgb-red/70 hover:text-lgb-red" : "text-white/20 hover:text-white/50"}`}>
                                {visibleOf(t) ? <Eye size={12} /> : <EyeOff size={12} />}
                              </button>
                            )}
                            <button onClick={() => borrarTarea(t)} className="text-white/20 hover:text-red-300 opacity-0 group-hover:opacity-100 shrink-0"><X size={12} /></button>
                          </div>
                        )}
                      </SortableTarea>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            <div className="flex gap-1.5 mt-2">
              <input value={nuevaTarea} onChange={(e) => setNuevaTarea(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTarea()}
                placeholder="+ agregar tarea" className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-lgb-red flex-1 min-w-0" />
              <select value={nuevaTareaResp} onChange={(e) => setNuevaTareaResp(e.target.value)} title="Asignar a"
                className="bg-white/5 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-lgb-red max-w-[80px]">
                <option value="" className="bg-lgb-dark">—</option>
                {equipo.map((m) => <option key={m.id} value={m.id} className="bg-lgb-dark">{m.nombre.split(" ")[0]}</option>)}
              </select>
              <button onClick={addTarea} disabled={busy || !nuevaTarea.trim()} className="bg-white/10 hover:bg-white/15 text-white px-2.5 rounded-lg text-xs disabled:opacity-40 shrink-0">Add</button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-white/50 hover:text-white text-xs"><Pencil size={12} /> Editar</button>
            {isAdmin && <button onClick={() => setConfirming(true)} className="flex items-center gap-1 text-red-300/70 hover:text-red-300 text-xs ml-auto"><Trash2 size={12} /> Eliminar</button>}
          </div>

          {confirming && (
            <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-lg px-2.5 py-2">
              <span className="text-xs text-white/70 mr-auto">¿Eliminar? No se deshace.</span>
              <button onClick={borrar} disabled={busy} className="bg-red-600 text-white px-2.5 py-1 rounded text-xs font-medium disabled:opacity-50">
                {busy ? <Loader2 size={12} className="animate-spin" /> : "Sí"}
              </button>
              <button onClick={() => setConfirming(false)} className="text-white/40 text-xs px-1">No</button>
            </div>
          )}
        </div>
      )}

      {/* Edición */}
      {editing && (
        <div className="border-t border-white/8 px-3 py-3 space-y-2">
          <div>
            <label className={lblS}>Título</label>
            <input value={ef.titulo} onChange={(e) => setEf((p) => ({ ...p, titulo: e.target.value }))} className={inp} />
          </div>
          {/* min-w-0 en cada celda: sin él, el input date impone su ancho
              intrínseco y se desborda de la columna del grid. */}
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 min-w-0">
              <label className={lblS}>Responsables</label>
              <ResponsablesPicker equipo={equipo} value={ef.responsables} onChange={(v) => setEf((p) => ({ ...p, responsables: v }))} />
            </div>
            {/* Producción = tiene cliente (venta/contacto pueden ligarse); interna =
                trabajo del equipo, sin cliente. Cambiarla no borra venta/contacto ya
                ligados — si un proyecto interno no debe tener ninguno, quítalo aparte. */}
            <div className="col-span-2 min-w-0">
              <label className={lblS}>Clase</label>
              <select value={ef.clase} onChange={(e) => setEf((p) => ({ ...p, clase: e.target.value as "produccion" | "interna" }))} className={inp}>
                <option value="produccion" className="bg-lgb-dark">Producción (cliente)</option>
                <option value="interna" className="bg-lgb-dark">Tarea interna</option>
              </select>
            </div>
            {/* El tipo define qué ve el cliente: EP/Álbum cambia su vista de
                avance a "canciones" (ver lib/cuenta-cliente). Antes solo se
                podía elegir al crear el proyecto. */}
            <div className="col-span-2 min-w-0">
              <label className={lblS}>Tipo</label>
              <select value={ef.tipo} onChange={(e) => setEf((p) => ({ ...p, tipo: e.target.value }))} className={inp}>
                <option value="" className="bg-lgb-dark">Sin tipo</option>
                {(ef.clase === "produccion" ? TIPOS_PROD : TIPOS_INT).map((t) => (
                  <option key={t} value={t} className="bg-lgb-dark">{TIPO_PROY_LABEL[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className={lblS}>Prioridad</label>
              <select value={ef.prioridad} onChange={(e) => setEf((p) => ({ ...p, prioridad: e.target.value }))} className={inp}>
                {["baja", "media", "alta"].map((x) => <option key={x} value={x} className="bg-lgb-dark">{PRIORIDAD_LABEL[x]}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <label className={lblS}>Entrega</label>
              <input type="date" value={ef.fecha_entrega} onChange={(e) => setEf((p) => ({ ...p, fecha_entrega: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2 min-w-0">
              <label className={lblS}>Link entregables</label>
              <input value={ef.entregable_url} onChange={(e) => setEf((p) => ({ ...p, entregable_url: e.target.value }))} placeholder="Drive…" className={inp} />
            </div>
          </div>
          {isAdmin && (
            <div>
              <label className={lblS}>Venta ligada <span className="text-white/25">(busca folio · beat · cliente)</span></label>
              <input list="ventas-link-list" value={ventaInput} onChange={(e) => onVenta(e.target.value)} placeholder="Sin venta ligada" className={inp} />
            </div>
          )}
          <div>
            <label className={lblS}>Brief / notas</label>
            <input value={ef.brief} onChange={(e) => setEf((p) => ({ ...p, brief: e.target.value }))} className={inp} />
          </div>
          {esContenidoPub(p.tipo) && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lblS}>Plataforma</label>
                <input list="plataformas-list" value={ef.plataforma} onChange={(e) => setEf((x) => ({ ...x, plataforma: e.target.value }))} placeholder="Instagram" className={inp} />
              </div>
              <div>
                <label className={lblS}>Fecha publicación</label>
                <input type="date" value={ef.fecha_publicacion} onChange={(e) => setEf((x) => ({ ...x, fecha_publicacion: e.target.value }))} className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lblS}>Link del post</label>
                <input value={ef.link_post} onChange={(e) => setEf((x) => ({ ...x, link_post: e.target.value }))} placeholder="https://…" className={inp} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={guardarEdit} disabled={busy} className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
              {busy ? <Loader2 size={13} className="animate-spin" /> : null} Guardar
            </button>
            <button onClick={() => setEditing(false)} className="text-white/40 hover:text-white text-xs px-2">Cancelar</button>
          </div>
        </div>
      )}

      {modalTarea && (
        <TareaModal tarea={modalTarea} equipo={equipo} busy={busy} contenido={esContenidoPub(p.tipo)}
          recordatorio={recordatorios[modalTarea.id] ?? null} miId={miId}
          onClose={() => setModalTareaId(null)}
          onAction={(method, body, url) => api(method, body, url)} />
      )}
    </div>
  );
}

// ── Ventana grande: detalle de una tarea (notas, responsable, subtareas) ──────
function TareaModal({ tarea, equipo, busy, contenido, recordatorio, miId, onClose, onAction }: {
  tarea: ProyectoTarea; equipo: Equipo[]; busy: boolean; contenido: boolean;
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

function ResponsablesPicker({ equipo, value, onChange }: { equipo: Equipo[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {equipo.map((m) => (
        <button key={m.id} type="button" onClick={() => toggle(m.id)}
          className={`px-2.5 py-1 rounded-full text-xs transition-colors ${value.includes(m.id) ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>{m.nombre}</button>
      ))}
      {equipo.length === 0 && <span className="text-white/30 text-xs">Sin equipo configurado</span>}
    </div>
  );
}

// ── Formulario Nuevo (producción o tarea interna) ─────────────────────────────
function NuevoProyecto({ equipo, clientes, onClose }: { equipo: Equipo[]; clientes: Cliente[]; onClose: () => void }) {
  const router = useRouter();
  const [clase, setClase] = useState<"produccion" | "interna">("produccion");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    titulo: "", tipo: "beat_personalizado", responsable_id: "", prioridad: "media",
    fecha_entrega: "", brief: "", notas: "",
    cliente: "", email: "", telefono: "", canal: "whatsapp",
    plataforma: "", fecha_publicacion: "", link_post: "", canciones: "", instrumentos: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const [responsables, setResponsables] = useState<string[]>([]);

  // Al escribir/elegir un cliente ya registrado, trae su email y teléfono.
  const onCliente = (v: string) => {
    const match = clientes.find((c) => norm(c.nombre) === norm(v));
    setF((p) => ({ ...p, cliente: v, ...(match ? { email: match.email ?? "", telefono: match.telefono ?? "" } : {}) }));
  };

  const tipos = clase === "produccion" ? TIPOS_PROD : TIPOS_INT;

  const submit = async () => {
    if (!f.titulo.trim()) { setError("Falta el título."); return; }
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/admin/proyectos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, responsables, clase, tipo: clase === "produccion" ? f.tipo : f.tipo }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "No se pudo crear.");
      else { onClose(); router.refresh(); toast(clase === "produccion" ? "✓ Producción creada" : "✓ Tarea creada"); }
    } catch { setError("Error de conexión."); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1.5">
          <button onClick={() => { setClase("produccion"); set("tipo", "beat_personalizado"); }}
            className={`px-3 py-1.5 rounded-full text-xs ${clase === "produccion" ? "bg-lgb-red text-white" : "bg-white/5 text-white/50"}`}>Producción</button>
          <button onClick={() => { setClase("interna"); set("tipo", "contenido"); }}
            className={`px-3 py-1.5 rounded-full text-xs ${clase === "interna" ? "bg-lgb-red text-white" : "bg-white/5 text-white/50"}`}>Tarea interna</button>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white"><X size={18} /></button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className={lblS}>{clase === "produccion" ? "Título / proyecto *" : "Tarea *"}</label>
          <input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder={clase === "produccion" ? "Beat para Axel Ardón" : "Subir reel semanal"} className={inp} />
        </div>
        <div>
          <label className={lblS}>Tipo</label>
          <select value={f.tipo} onChange={(e) => set("tipo", e.target.value)} className={inp}>
            {tipos.map((t) => <option key={t} value={t} className="bg-lgb-dark">{TIPO_PROY_LABEL[t] ?? t}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className={lblS}>Responsables <span className="text-white/25">(uno o varios)</span></label>
          <ResponsablesPicker equipo={equipo} value={responsables} onChange={setResponsables} />
        </div>
        <div>
          <label className={lblS}>Prioridad</label>
          <select value={f.prioridad} onChange={(e) => set("prioridad", e.target.value)} className={inp}>
            {["baja", "media", "alta"].map((x) => <option key={x} value={x} className="bg-lgb-dark">{PRIORIDAD_LABEL[x]}</option>)}
          </select>
        </div>
        <div>
          <label className={lblS}>Entrega</label>
          <input type="date" value={f.fecha_entrega} onChange={(e) => set("fecha_entrega", e.target.value)} className={inp} />
        </div>

        {clase === "produccion" && !esContenido(f.tipo) && (
          <>
            <div>
              <label className={lblS}>Cliente <span className="text-white/25">(sugerencias)</span></label>
              <input list="clientes-prod" value={f.cliente} onChange={(e) => onCliente(e.target.value)} placeholder="Nombre" className={inp} />
              <datalist id="clientes-prod">
                {clientes.slice(0, 800).map((c, i) => <option key={i} value={c.nombre} />)}
              </datalist>
            </div>
            <div>
              <label className={lblS}>WhatsApp</label>
              <input value={f.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="477…" className={inp} />
            </div>
            <div>
              <label className={lblS}>Email</label>
              <input value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="correo" className={inp} />
            </div>
          </>
        )}

        <div className={clase === "produccion" ? "col-span-2 sm:col-span-4" : "col-span-2 sm:col-span-3"}>
          <label className={lblS}>{clase === "produccion" ? "Brief (lo que pidió)" : "Notas"}</label>
          <input value={clase === "produccion" ? f.brief : f.notas} onChange={(e) => set(clase === "produccion" ? "brief" : "notas", e.target.value)} className={inp} />
        </div>

        {(f.tipo === "ep" || f.tipo === "album") && (
          <div className="col-span-2 sm:col-span-4">
            <label className={lblS}>Canciones del EP/Álbum <span className="text-white/25">(una por línea → se vuelven tareas)</span></label>
            <textarea value={f.canciones} onChange={(e) => setF((p) => ({ ...p, canciones: e.target.value }))} rows={4} placeholder={"Intro\nLa vida que elegí\nSin miedo\n…"} className={inp} />
          </div>
        )}

        {(f.tipo === "grabacion" || f.tipo === "beat_personalizado") && (
          <div className="col-span-2 sm:col-span-4">
            <label className={lblS}>Instrumentos a grabar <span className="text-white/25">(cada uno → tarea &quot;Grabar…&quot;)</span></label>
            <InstrumentosPicker value={f.instrumentos} onChange={(v) => set("instrumentos", v)} />
          </div>
        )}

        {esContenidoPub(f.tipo) && (
          <>
            <div>
              <label className={lblS}>Plataforma</label>
              <input list="plataformas-list" value={f.plataforma} onChange={(e) => set("plataforma", e.target.value)} placeholder="Instagram" className={inp} />
            </div>
            <div>
              <label className={lblS}>Fecha de publicación</label>
              <input type="date" value={f.fecha_publicacion} onChange={(e) => set("fecha_publicacion", e.target.value)} className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lblS}>Link del post <span className="text-white/25">(cuando se publique)</span></label>
              <input value={f.link_post} onChange={(e) => set("link_post", e.target.value)} placeholder="https://…" className={inp} />
            </div>
          </>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      <button onClick={submit} disabled={saving}
        className="flex items-center gap-2 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 disabled:opacity-50 mt-4">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
        {saving ? "Creando…" : clase === "produccion" ? "Crear producción" : "Crear tarea"}
      </button>
    </div>
  );
}
