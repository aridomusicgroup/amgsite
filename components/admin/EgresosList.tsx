"use client";
import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import type { EgresoRow } from "@/lib/erp-data";
import { toast } from "@/lib/toast";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const fecha = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
const mesLabel = (k: string) =>
  new Date(k + "-15T12:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });

const TIPOS = [
  { k: "todos", label: "Todos" },
  { k: "gasto", label: "Gastos" },
  { k: "capex", label: "Inversión" },
] as const;

export function EgresosList({ egresos }: { egresos: EgresoRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [mes, setMes] = useState("todos");
  const [tipo, setTipo] = useState<string>("todos");

  // Acciones por long-press (editar / eliminar) — la página de Finanzas ya es admin-only
  const [actionsId, setActionsId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ef, setEf] = useState({ fecha: "", categoria: "", proveedor: "", descripcion: "", total_mxn: "", es_capex: false });
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

  const categorias = useMemo(() => {
    const s = new Set<string>();
    for (const e of egresos) if (e.categoria) s.add(e.categoria);
    return ["todas", ...[...s].sort()];
  }, [egresos]);

  const meses = useMemo(() => {
    const s = new Set<string>();
    for (const e of egresos) if (e.fecha) s.add(e.fecha.slice(0, 7));
    return ["todos", ...[...s].sort((a, b) => b.localeCompare(a))];
  }, [egresos]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return egresos.filter((e) => {
      if (categoria !== "todas" && e.categoria !== categoria) return false;
      if (mes !== "todos" && (e.fecha ?? "").slice(0, 7) !== mes) return false;
      if (tipo === "capex" && !e.es_capex) return false;
      if (tipo === "gasto" && e.es_capex) return false;
      if (!term) return true;
      return (
        (e.descripcion ?? "").toLowerCase().includes(term) ||
        (e.proveedor ?? "").toLowerCase().includes(term) ||
        (e.categoria ?? "").toLowerCase().includes(term)
      );
    });
  }, [egresos, q, categoria, mes, tipo]);

  const totalFiltrado = list.reduce((a, e) => a + e.total_mxn, 0);
  const sel = "bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lgb-red";
  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red w-full";
  const lblS = "block text-[10px] text-white/40 mb-1";

  const abrirEdit = (e: EgresoRow) => {
    setEditingId(e.id); setActionsId(null);
    setEf({
      fecha: e.fecha || "",
      categoria: e.categoria || "",
      proveedor: e.proveedor || "",
      descripcion: e.descripcion || "",
      total_mxn: String(e.total_mxn ?? ""),
      es_capex: e.es_capex,
    });
    setEditErr(null);
  };

  const submitEdit = async (id: string) => {
    setEditSaving(true); setEditErr(null);
    try {
      const r = await fetch("/api/admin/egresos", {
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
      const r = await fetch("/api/admin/egresos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) setDeleteErr(d.error || "No se pudo eliminar.");
      else { setConfirmDeleteId(null); router.refresh(); toast("✓ Egreso eliminado"); }
    } catch { setDeleteErr("Error de conexión."); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por descripción, proveedor o categoría…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TIPOS.map((t) => (
            <button
              key={t.k}
              onClick={() => setTipo(t.k)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                tipo === t.k ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={sel}>
            {categorias.map((c) => (
              <option key={c} value={c} className="bg-lgb-dark">
                {c === "todas" ? "Todas las categorías" : c}
              </option>
            ))}
          </select>
          <select value={mes} onChange={(e) => setMes(e.target.value)} className={`${sel} capitalize`}>
            {meses.map((m) => (
              <option key={m} value={m} className="bg-lgb-dark capitalize">
                {m === "todos" ? "Todos los meses" : mesLabel(m)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-white/40 text-xs">
          {list.length} egresos · <span className="text-white/70 font-medium">{peso(totalFiltrado)}</span>
        </p>
      </div>

      <p className="text-white/25 text-[11px] mb-2">Mantén presionado un egreso para editarlo o eliminarlo.</p>

      {list.length === 0 ? (
        <p className="text-white/30 text-sm">No hay egresos que coincidan.</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((e) => {
            const abierta = actionsId === e.id || editingId === e.id || confirmDeleteId === e.id;
            return (
              <li
                key={e.id}
                onPointerDown={(ev) => startPress(ev, e.id)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(ev) => ev.preventDefault()}
                className={`bg-white/[0.03] border rounded-xl px-4 py-2.5 select-none transition-colors ${abierta ? "border-lgb-red/40" : "border-white/8"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm truncate">{e.descripcion || e.categoria || "Egreso"}</p>
                      {e.categoria && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">{e.categoria}</span>
                      )}
                      {e.es_capex && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">inversión</span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">
                      {fecha(e.fecha)}{e.proveedor ? ` · ${e.proveedor}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-medium flex-shrink-0">{peso(e.total_mxn)}</span>
                  <button onClick={() => setActionsId((id) => (id === e.id ? null : e.id))} className="text-white/25 hover:text-white shrink-0 p-1" title="Editar / eliminar"><MoreHorizontal size={16} /></button>
                </div>

                {/* Barra de acciones (long-press) */}
                {actionsId === e.id && editingId !== e.id && confirmDeleteId !== e.id && (
                  <div className="mt-3 pt-3 border-t border-white/8 flex items-center gap-2">
                    <span className="text-white/40 text-xs mr-auto">Acciones</span>
                    <button onClick={() => abrirEdit(e)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                      <Pencil size={13} /> Editar
                    </button>
                    <button onClick={() => { setConfirmDeleteId(e.id); setActionsId(null); setDeleteErr(null); }} className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium">
                      <Trash2 size={13} /> Eliminar
                    </button>
                    <button onClick={() => setActionsId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cerrar</button>
                  </div>
                )}

                {/* Formulario de edición */}
                {editingId === e.id && (
                  <div className="mt-3 pt-3 border-t border-white/8 select-text">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <label className={lblS}>Fecha</label>
                        <input type="date" value={ef.fecha} onChange={(ev) => setEf((p) => ({ ...p, fecha: ev.target.value }))} className={inp} />
                      </div>
                      <div>
                        <label className={lblS}>Categoría</label>
                        <input value={ef.categoria} onChange={(ev) => setEf((p) => ({ ...p, categoria: ev.target.value }))} className={inp} />
                      </div>
                      <div>
                        <label className={lblS}>Proveedor</label>
                        <input value={ef.proveedor} onChange={(ev) => setEf((p) => ({ ...p, proveedor: ev.target.value }))} className={inp} />
                      </div>
                      <div className="col-span-2">
                        <label className={lblS}>Descripción</label>
                        <input value={ef.descripcion} onChange={(ev) => setEf((p) => ({ ...p, descripcion: ev.target.value }))} className={inp} />
                      </div>
                      <div>
                        <label className={lblS}>Total MXN</label>
                        <input type="number" step="any" value={ef.total_mxn} onChange={(ev) => setEf((p) => ({ ...p, total_mxn: ev.target.value }))} className={inp} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 mt-2 text-xs text-white/60 cursor-pointer">
                      <input type="checkbox" checked={ef.es_capex} onChange={(ev) => setEf((p) => ({ ...p, es_capex: ev.target.checked }))} className="accent-lgb-red w-4 h-4" />
                      Es inversión (CAPEX), no gasto recurrente
                    </label>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => submitEdit(e.id)} disabled={editSaving}
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
                {confirmDeleteId === e.id && (
                  <div className="mt-3 pt-3 border-t border-red-500/20 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-white/80">
                      ¿Eliminar este egreso? <span className="text-white/40">No se puede deshacer.</span>
                    </p>
                    <div className="flex gap-2 ml-auto">
                      <button onClick={() => doDelete(e.id)} disabled={deleting}
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
      )}
    </div>
  );
}
