"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Phone, Mail, TrendingUp, Merge, Download, Loader2, Pencil, Trash2, MoreHorizontal, History, CalendarClock } from "lucide-react";
import type { Contacto } from "@/lib/erp-data";
import { ETAPA_LABEL } from "@/lib/erp-data";
import { toast } from "@/lib/toast";
import { ClienteCorreosExtra } from "./ClienteCorreosExtra";
import { AvisoCorreoPedido } from "./AvisoCorreoPedido";
import { CrmTimeline } from "./CrmTimeline";
import { CrmSeguimiento } from "./CrmSeguimiento";
import { useDestacar } from "@/lib/useDestacar";

const ETAPA_STYLE: Record<string, string> = {
  lead: "bg-white/10 text-white/60",
  negociacion: "bg-amber-500/15 text-amber-300",
  cliente: "bg-green-500/15 text-green-300",
  recurrente: "bg-lgb-red/20 text-lgb-red",
  perdido: "bg-white/5 text-white/35",
  inactivo: "bg-white/5 text-white/35",
};

const ORIGEN_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", tiktok: "TikTok",
  beatstars: "BeatStars", facebook: "Facebook", sitio: "Sitio web",
};
const ORIGENES = ["whatsapp", "instagram", "tiktok", "beatstars", "facebook", "sitio"];
const ETAPAS_EDIT = ["lead", "negociacion", "cliente", "recurrente", "perdido", "inactivo"];

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const ETAPAS = ["todos", "recurrente", "cliente", "negociacion", "lead", "perdido"] as const;
const VIP_MIN = 10000;
/** Etapas que siguen "vivas": son las que deberían tener una próxima acción. */
const ABIERTAS = ["lead", "negociacion"];
const hoyISO = new Date().toISOString().slice(0, 10);

type Sort = "ltv" | "compras" | "nombre" | "recientes" | "ultima";

const dias = (fecha: string | null): number | null => {
  if (!fecha) return null;
  return Math.floor((Date.now() - new Date(fecha + "T12:00:00").getTime()) / 86400000);
};

export function CrmList({ contactos, isAdmin = false, focoInicial, contactoInicial }: {
  contactos: Contacto[];
  isAdmin?: boolean;
  /** Foco preseleccionado desde Marketing (`?foco=toca|sin`). */
  focoInicial?: "toca" | "sin";
  /** Contactabilidad preseleccionada desde Marketing (`?contacto=email|whatsapp`). */
  contactoInicial?: string;
}) {
  const router = useRouter();
  const [mergeMode, setMergeMode] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [q, setQ] = useState("");
  const [etapa, setEtapa] = useState("todos");
  const [origen, setOrigen] = useState("todos");
  const [contacto, setContacto] = useState(contactoInicial ?? "todos"); // contactabilidad
  const [valor, setValor] = useState("todos");
  const [recencia, setRecencia] = useState("todos");
  const [sort, setSort] = useState<Sort>("ltv");
  const [soloConsolidados, setSoloConsolidados] = useState(false);

  // Acciones por long-press (editar / eliminar) — solo admins
  const [actionsId, setActionsId] = useState<string | null>(null);
  /** Contacto con la línea de tiempo abierta (null = ninguna). */
  const [historialId, setHistorialId] = useState<string | null>(null);
  /** Foco de trabajo: "toca" = vence hoy o antes · "sin" = abierto sin seguimiento. */
  const [foco, setFoco] = useState<"todos" | "toca" | "sin">(focoInicial ?? "todos");

  // Llegando desde la campanita de Clientes (?destacar=<contacto>): se abren
  // los filtros para que el contacto no quede escondido, se le prende el
  // resplandor y se le abre su línea de tiempo — que es justo lo que pasó.
  const destacado = useDestacar();
  useEffect(() => {
    if (!destacado) return;
    setQ(""); setEtapa("todos"); setOrigen("todos"); setContacto("todos");
    setValor("todos"); setRecencia("todos"); setFoco("todos");
    setHistorialId(destacado);
  }, [destacado]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ef, setEf] = useState({ nombre: "", telefono: "", email: "", direccion: "", etapa: "", origen: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  const startPress = (e: React.PointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest("button,input,select,a,label")) return;
    cancelPress();
    pressTimer.current = setTimeout(() => {
      setActionsId(id); setEditingId(null); setConfirmDeleteId(null);
    }, 600);
  };

  const origenes = useMemo(() => {
    const s = new Set<string>();
    for (const c of contactos) if (c.origen) s.add(c.origen);
    return ["todos", ...s];
  }, [contactos]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = contactos.filter((c) => {
      if (etapa !== "todos" && c.etapa !== etapa) return false;
      if (origen !== "todos" && c.origen !== origen) return false;
      if (soloConsolidados && c.mergedFrom.length === 0) return false;

      // Foco de seguimiento: qué toca trabajar hoy.
      if (foco === "toca" && !(c.proximaFecha && c.proximaFecha <= hoyISO)) return false;
      if (foco === "sin" && (c.proximaAccion || !ABIERTAS.includes(c.etapa))) return false;

      const hasMail = !!c.email, hasTel = !!c.telefono;
      if (contacto === "email" && !hasMail) return false;
      if (contacto === "whatsapp" && !hasTel) return false;
      if (contacto === "ambos" && !(hasMail && hasTel)) return false;
      if (contacto === "sin" && (hasMail || hasTel)) return false;

      if (valor === "vip" && c.ltv < VIP_MIN) return false;
      if (valor === "comprador" && c.ltv <= 0) return false;
      if (valor === "sincompra" && c.ltv > 0) return false;

      const d = dias(c.ultimaCompra);
      if (recencia === "activos" && !(d !== null && d <= 90)) return false;
      if (recencia === "inactivos90" && !(d !== null && d > 90)) return false;
      if (recencia === "inactivos180" && !(d !== null && d > 180)) return false;
      if (recencia === "nunca" && d !== null) return false;

      if (!term) return true;
      return (
        (c.nombre ?? "").toLowerCase().includes(term) ||
        (c.telefono ?? "").includes(term) ||
        (c.email ?? "").toLowerCase().includes(term) ||
        c.mergedFrom.some((n) => n.toLowerCase().includes(term))
      );
    });
    out.sort((a, b) => {
      if (sort === "ltv") return b.ltv - a.ltv;
      if (sort === "compras") return b.ventasCount - a.ventasCount;
      if (sort === "nombre") return (a.nombre ?? "").localeCompare(b.nombre ?? "");
      if (sort === "ultima") return (b.ultimaCompra ?? "").localeCompare(a.ultimaCompra ?? "");
      return b.created_at.localeCompare(a.created_at);
    });
    return out;
  }, [contactos, q, etapa, origen, contacto, valor, recencia, sort, soloConsolidados, foco]);

  // Conteos para los chips de foco (sobre TODOS los contactos, no los filtrados).
  const nToca = contactos.filter((c) => c.proximaFecha && c.proximaFecha <= hoyISO).length;
  const nSin = contactos.filter((c) => !c.proximaAccion && ABIERTAS.includes(c.etapa)).length;

  // Resumen del segmento (lo que ve Tozi antes de lanzar campaña)
  const seg = useMemo(() => ({
    total: list.length,
    conEmail: list.filter((c) => c.email).length,
    conTel: list.filter((c) => c.telefono).length,
    ltv: list.reduce((a, c) => a + c.ltv, 0),
  }), [list]);

  const totalConsolidados = contactos.filter((c) => c.mergedFrom.length > 0).length;
  const sel = "bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lgb-red";
  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red w-full";
  const lblS = "block text-[10px] text-white/40 mb-1";

  const exportar = () => {
    const headers = ["Nombre", "Email", "Telefono", "Etapa", "Canal", "Compras", "LTV", "UltimaCompra"];
    const filas = list.map((c) => [
      c.nombre ?? "", c.email ?? "", c.telefono ?? "",
      ETAPA_LABEL[c.etapa] ?? c.etapa, c.origen ?? "",
      String(c.ventasCount), String(Math.round(c.ltv)), c.ultimaCompra ?? "",
    ]);
    const csv = [headers, ...filas]
      .map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-segmento-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fusión manual
  const toggleSel = (id: string) =>
    setSeleccion((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  const cancelarFusion = () => { setMergeMode(false); setSeleccion(new Set()); };
  const fusionar = async () => {
    if (seleccion.size < 2) return;
    const nombres = contactos.filter((c) => seleccion.has(c.id)).map((c) => c.nombre || "(sin nombre)");
    if (!confirm(`¿Fusionar en un solo cliente?\n\n${nombres.join("\n")}\n\nEs reversible.`)) return;
    setMerging(true);
    try {
      const r = await fetch("/api/admin/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...seleccion] }),
      });
      if (r.ok) { cancelarFusion(); router.refresh(); }
      else { const d = await r.json().catch(() => ({})); alert(d.error || "No se pudo fusionar."); }
    } catch { alert("Error de conexión."); }
    finally { setMerging(false); }
  };

  // Editar / eliminar
  const abrirEdit = (c: Contacto) => {
    setEditingId(c.id); setActionsId(null);
    setEf({
      nombre: c.nombre || "",
      telefono: c.telefono || "",
      email: c.email || "",
      direccion: c.direccion || "",
      etapa: c.etapa || "",
      origen: c.origen || "",
    });
    setEditErr(null);
  };
  const setE = (k: keyof typeof ef) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEf((p) => ({ ...p, [k]: e.target.value }));

  const submitEdit = async (id: string) => {
    setEditSaving(true); setEditErr(null);
    try {
      const r = await fetch("/api/admin/contactos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...ef }),
      });
      const d = await r.json();
      if (!r.ok) setEditErr(d.error || "No se pudo guardar.");
      else { setEditingId(null); router.refresh(); toast("✓ Guardado"); }
    } catch { setEditErr("Error de conexión."); }
    finally { setEditSaving(false); }
  };

  const doDelete = async (id: string) => {
    setDeleting(true); setDeleteErr(null);
    try {
      const r = await fetch("/api/admin/contactos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) setDeleteErr(d.error || "No se pudo eliminar.");
      else { setConfirmDeleteId(null); router.refresh(); toast("✓ Cliente eliminado"); }
    } catch { setDeleteErr("Error de conexión."); }
    finally { setDeleting(false); }
  };

  const lp = (id: string) =>
    isAdmin && !mergeMode
      ? {
          onPointerDown: (e: React.PointerEvent) => startPress(e, id),
          onPointerUp: cancelPress,
          onPointerLeave: cancelPress,
          onPointerCancel: cancelPress,
          onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
        }
      : {};

  return (
    <div>
      {/* Buscador */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, teléfono, email…"
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red"
        />
      </div>

      {/* Etapa */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        {ETAPAS.map((f) => (
          <button key={f} onClick={() => setEtapa(f)}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${etapa === f ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>
            {f === "todos" ? "Todos" : ETAPA_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Segmentación de marketing */}
      <div className="flex gap-2 flex-wrap items-center mb-2">
        <select value={origen} onChange={(e) => setOrigen(e.target.value)} className={sel}>
          {origenes.map((o) => <option key={o} value={o} className="bg-lgb-dark">{o === "todos" ? "Todos los canales" : ORIGEN_LABEL[o] ?? o}</option>)}
        </select>
        <select value={contacto} onChange={(e) => setContacto(e.target.value)} className={sel}>
          <option value="todos" className="bg-lgb-dark">Contactabilidad</option>
          <option value="email" className="bg-lgb-dark">📧 Con email</option>
          <option value="whatsapp" className="bg-lgb-dark">📱 Con WhatsApp</option>
          <option value="ambos" className="bg-lgb-dark">Email + WhatsApp</option>
          <option value="sin" className="bg-lgb-dark">Sin datos de contacto</option>
        </select>
        <select value={valor} onChange={(e) => setValor(e.target.value)} className={sel}>
          <option value="todos" className="bg-lgb-dark">Valor</option>
          <option value="vip" className="bg-lgb-dark">⭐ VIP (≥ {peso(VIP_MIN)})</option>
          <option value="comprador" className="bg-lgb-dark">Han comprado</option>
          <option value="sincompra" className="bg-lgb-dark">Sin compra aún</option>
        </select>
        <select value={recencia} onChange={(e) => setRecencia(e.target.value)} className={sel}>
          <option value="todos" className="bg-lgb-dark">Recencia</option>
          <option value="activos" className="bg-lgb-dark">Activos (≤ 90 días)</option>
          <option value="inactivos90" className="bg-lgb-dark">Inactivos (&gt; 90 días)</option>
          <option value="inactivos180" className="bg-lgb-dark">Inactivos (&gt; 180 días)</option>
          <option value="nunca" className="bg-lgb-dark">Nunca han comprado</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={sel}>
          <option value="ltv" className="bg-lgb-dark">Más comprado</option>
          <option value="compras" className="bg-lgb-dark"># de compras</option>
          <option value="ultima" className="bg-lgb-dark">Compra más reciente</option>
          <option value="nombre" className="bg-lgb-dark">Nombre A–Z</option>
          <option value="recientes" className="bg-lgb-dark">Agregados recientes</option>
        </select>
        {/* Foco de seguimiento: lo que toca trabajar, primero que todo. */}
        {nToca > 0 && (
          <button onClick={() => setFoco((v) => (v === "toca" ? "todos" : "toca"))}
            className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${foco === "toca" ? "bg-lgb-red text-white" : "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"}`}>
            <CalendarClock size={13} /> Toca hoy ({nToca})
          </button>
        )}
        {nSin > 0 && (
          <button onClick={() => setFoco((v) => (v === "sin" ? "todos" : "sin"))}
            className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${foco === "sin" ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>
            Sin seguimiento ({nSin})
          </button>
        )}
        {totalConsolidados > 0 && (
          <button onClick={() => setSoloConsolidados((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${soloConsolidados ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>
            <Merge size={13} /> Consolidados ({totalConsolidados})
          </button>
        )}
        <button onClick={() => (mergeMode ? cancelarFusion() : setMergeMode(true))}
          className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${mergeMode ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"}`}>
          <Merge size={13} /> {mergeMode ? "Cancelar fusión" : "Fusionar manual"}
        </button>
      </div>

      {mergeMode && (
        <p className="text-blue-300/70 text-xs mb-3">
          Marca 2 o más fichas del mismo cliente (ej. &quot;Jehu&quot; y &quot;Jehu Núñez&quot;) y pulsa Fusionar.
        </p>
      )}

      {/* Resumen del segmento + exportar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4 rounded-xl bg-white/[0.03] border border-white/8 px-4 py-2.5">
        <div className="flex gap-4 flex-wrap text-xs text-white/60">
          <span><b className="text-white">{seg.total}</b> contactos</span>
          <span className="flex items-center gap-1"><Mail size={12} /> <b className="text-white">{seg.conEmail}</b> con email</span>
          <span className="flex items-center gap-1"><Phone size={12} /> <b className="text-white">{seg.conTel}</b> con WhatsApp</span>
          <span>LTV del segmento: <b className="text-green-300">{peso(seg.ltv)}</b></span>
        </div>
        <button onClick={exportar} disabled={list.length === 0}
          className="flex items-center gap-2 bg-lgb-red text-white px-4 py-1.5 rounded-full text-xs font-medium hover:bg-red-700 transition-all disabled:opacity-40">
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {isAdmin && !mergeMode && (
        <p className="text-white/25 text-[11px] mb-2">Mantén presionado un cliente para editarlo o eliminarlo.</p>
      )}

      <ul className="space-y-2">
        {list.map((c) => {
          const d = dias(c.ultimaCompra);
          const abierta = actionsId === c.id || editingId === c.id || confirmDeleteId === c.id;
          return (
            <li key={c.id}
              {...lp(c.id)}
              data-destacar-id={c.id}
              onClick={mergeMode ? () => toggleSel(c.id) : undefined}
              className={`bg-white/[0.03] border rounded-xl px-4 py-3 transition-colors ${isAdmin && !mergeMode ? "select-none" : ""} ${
                (mergeMode && seleccion.has(c.id)) || abierta ? "border-lgb-red" : "border-white/8"
              } ${mergeMode ? "cursor-pointer" : ""} ${destacado === c.id ? "arido-destacado" : ""}`}>
              <div className="flex items-center gap-3">
                {mergeMode && (
                  <input type="checkbox" checked={seleccion.has(c.id)} onChange={() => toggleSel(c.id)}
                    className="accent-lgb-red w-4 h-4 flex-shrink-0" onClick={(e) => e.stopPropagation()} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{c.nombre || "(sin nombre)"}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ETAPA_STYLE[c.etapa] ?? "bg-white/10 text-white/50"}`}>
                      {ETAPA_LABEL[c.etapa] ?? c.etapa}
                    </span>
                    {c.origen && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">{ORIGEN_LABEL[c.origen] ?? c.origen}</span>}
                    {c.ltv >= VIP_MIN && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">⭐ VIP</span>}
                    {c.mergedFrom.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 flex items-center gap-1" title={`Fusionado con: ${c.mergedFrom.join(", ")}`}>
                        <Merge size={10} /> consolidado ({c.mergedFrom.length})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-white/40 text-xs flex-wrap">
                    {c.telefono && <span className="flex items-center gap-1"><Phone size={11} /> {c.telefono}</span>}
                    {c.email && <span className="flex items-center gap-1 truncate"><Mail size={11} /> {c.email}</span>}
                    {c.ventasCount > 0 && <span>· {c.ventasCount} {c.ventasCount === 1 ? "compra" : "compras"}</span>}
                    {d !== null && <span className={d > 90 ? "text-amber-300/70" : ""}>· última hace {d}d</span>}
                    {c.servicio_interes && <span className="truncate">· {c.servicio_interes}</span>}
                  </div>
                  {c.mergedFrom.length > 0 && <p className="text-blue-300/60 text-[11px] mt-1 truncate">Incluye: {c.mergedFrom.join(" · ")}</p>}
                  {!mergeMode && (
                    <CrmSeguimiento contactoId={c.id} accion={c.proximaAccion} fecha={c.proximaFecha} />
                  )}
                </div>
                {c.ltv > 0 && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-green-300 flex items-center gap-1"><TrendingUp size={12} /> {peso(c.ltv)}</p>
                    <p className="text-white/30 text-[10px]">comprado</p>
                  </div>
                )}
                {!mergeMode && (
                  <button
                    onClick={() => setHistorialId((id) => (id === c.id ? null : c.id))}
                    className={`shrink-0 p-1 transition-colors ${historialId === c.id ? "text-lgb-red" : "text-white/25 hover:text-white"}`}
                    title="Ver historial"
                  >
                    <History size={16} />
                  </button>
                )}
                {isAdmin && !mergeMode && (
                  <button onClick={() => setActionsId((id) => (id === c.id ? null : c.id))} className="text-white/25 hover:text-white shrink-0 p-1" title="Editar / eliminar"><MoreHorizontal size={16} /></button>
                )}
              </div>

              {historialId === c.id && <CrmTimeline contactoId={c.id} />}

              {/* Barra de acciones (long-press) */}
              {actionsId === c.id && editingId !== c.id && confirmDeleteId !== c.id && (
                <div className="mt-3 pt-3 border-t border-white/8 flex items-center gap-2">
                  <span className="text-white/40 text-xs mr-auto">Acciones</span>
                  <button onClick={() => abrirEdit(c)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                    <Pencil size={13} /> Editar
                  </button>
                  <button onClick={() => { setConfirmDeleteId(c.id); setActionsId(null); setDeleteErr(null); }} className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium">
                    <Trash2 size={13} /> Eliminar
                  </button>
                  <button onClick={() => setActionsId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cerrar</button>
                </div>
              )}

              {/* Formulario de edición */}
              {editingId === c.id && (
                <div className="mt-3 pt-3 border-t border-white/8 select-text">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="col-span-2 sm:col-span-1">
                      <label className={lblS}>Nombre</label>
                      <input value={ef.nombre} onChange={setE("nombre")} className={inp} />
                    </div>
                    <div>
                      <label className={lblS}>Teléfono</label>
                      <input value={ef.telefono} onChange={setE("telefono")} className={inp} />
                    </div>
                    <div>
                      <label className={lblS}>Email</label>
                      <input type="email" value={ef.email} onChange={setE("email")} className={inp} />
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <label className={lblS}>Dirección (para contratos)</label>
                      <input value={ef.direccion} onChange={setE("direccion")} className={inp} placeholder="Calle, número, colonia, ciudad, CP" />
                    </div>
                    <div>
                      <label className={lblS}>Etapa</label>
                      <select value={ef.etapa} onChange={setE("etapa")} className={inp}>
                        {ETAPAS_EDIT.map((s) => <option key={s} value={s} className="bg-lgb-dark">{ETAPA_LABEL[s] ?? s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lblS}>Canal de origen</label>
                      <select value={ef.origen} onChange={setE("origen")} className={inp}>
                        <option value="" className="bg-lgb-dark">—</option>
                        {ORIGENES.map((o) => <option key={o} value={o} className="bg-lgb-dark">{ORIGEN_LABEL[o]}</option>)}
                      </select>
                    </div>
                  </div>
                  {c.email && <AvisoCorreoPedido contactoId={c.id} email={c.email} />}
                  {c.email && <ClienteCorreosExtra principalEmail={c.email} />}
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => submitEdit(c.id)} disabled={editSaving}
                      className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                      {editSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                      Guardar cambios
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cancelar</button>
                    {editErr && <p className="text-red-400 text-xs">{editErr}</p>}
                  </div>
                </div>
              )}

              {/* Confirmación de borrado */}
              {confirmDeleteId === c.id && (
                <div className="mt-3 pt-3 border-t border-red-500/20 flex flex-wrap items-center gap-3">
                  <p className="text-sm text-white/80">
                    ¿Eliminar a <b>{c.nombre || "este contacto"}</b>?{" "}
                    <span className="text-white/40">
                      {c.ventasCount > 0 ? `Sus ${c.ventasCount} ${c.ventasCount === 1 ? "venta se conserva" : "ventas se conservan"} (solo se desvincula). ` : ""}No se puede deshacer.
                    </span>
                  </p>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => doDelete(c.id)} disabled={deleting}
                      className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                      {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Sí, eliminar
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-white/50 hover:text-white text-xs px-3 py-1.5">Cancelar</button>
                  </div>
                  {deleteErr && <p className="text-red-400 text-xs w-full">{deleteErr}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {list.length === 0 && <p className="text-white/30 text-sm text-center py-8">Ningún contacto en este segmento.</p>}

      {mergeMode && seleccion.size > 0 && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-lgb-dark border border-white/15 rounded-full pl-4 pr-2 py-2 shadow-2xl">
          <span className="text-sm text-white/70">{seleccion.size} seleccionados</span>
          <button onClick={fusionar} disabled={seleccion.size < 2 || merging}
            className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-40">
            {merging ? <Loader2 size={14} className="animate-spin" /> : <Merge size={14} />}
            Fusionar
          </button>
          <button onClick={cancelarFusion} className="text-white/40 hover:text-white text-sm px-2">Cancelar</button>
        </div>
      )}
    </div>
  );
}
