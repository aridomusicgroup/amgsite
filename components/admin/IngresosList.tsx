"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Pencil, Trash2, MoreHorizontal, Repeat } from "lucide-react";
import type { IngresoRow } from "@/lib/erp-data";
import { toast } from "@/lib/toast";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const fecha = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
const mesLabel = (k: string) =>
  new Date(k + "-15T12:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });

export function IngresosList({ ingresos }: { ingresos: IngresoRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mes, setMes] = useState("todos");
  const [actionsId, setActionsId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ef, setEf] = useState({ fecha: "", fuente: "", concepto: "", monto_mxn: "", recurrente: false, nota: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const meses = useMemo(() => {
    const s = new Set<string>();
    for (const i of ingresos) if (i.fecha) s.add(i.fecha.slice(0, 7));
    return ["todos", ...[...s].sort((a, b) => b.localeCompare(a))];
  }, [ingresos]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ingresos.filter((i) => {
      if (mes !== "todos" && (i.fecha ?? "").slice(0, 7) !== mes) return false;
      if (!term) return true;
      return (
        (i.concepto ?? "").toLowerCase().includes(term) ||
        (i.fuente ?? "").toLowerCase().includes(term) ||
        (i.nota ?? "").toLowerCase().includes(term)
      );
    });
  }, [ingresos, q, mes]);

  const totalFiltrado = list.reduce((a, i) => a + i.monto_mxn, 0);
  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500 w-full";
  const sel = "bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500";
  const lblS = "block text-[10px] text-white/40 mb-1";

  const abrirEdit = (i: IngresoRow) => {
    setEditingId(i.id); setActionsId(null);
    setEf({
      fecha: i.fecha || "", fuente: i.fuente || "", concepto: i.concepto || "",
      monto_mxn: String(i.monto_mxn ?? ""), recurrente: i.recurrente, nota: i.nota || "",
    });
    setEditErr(null);
  };

  const submitEdit = async (id: string) => {
    setEditSaving(true); setEditErr(null);
    try {
      const r = await fetch("/api/admin/ingresos", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...ef }),
      });
      const d = await r.json();
      if (!r.ok) setEditErr(d.error || "No se pudo guardar.");
      else { setEditingId(null); router.refresh(); toast("✓ Guardado"); }
    } catch { setEditErr("Error de conexión."); }
    finally { setEditSaving(false); }
  };

  const doDelete = async (id: string) => {
    setDeleting(true);
    try {
      const r = await fetch("/api/admin/ingresos", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (r.ok) { setConfirmDeleteId(null); router.refresh(); toast("✓ Ingreso eliminado"); }
    } catch { /* */ }
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
            placeholder="Buscar por concepto, fuente o nota…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select value={mes} onChange={(e) => setMes(e.target.value)} className={`${sel} capitalize`}>
          {meses.map((m) => (
            <option key={m} value={m} className="bg-lgb-dark capitalize">
              {m === "todos" ? "Todos los meses" : mesLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-end mb-3">
        <p className="text-white/40 text-xs">
          {list.length} ingresos · <span className="text-green-300 font-medium">{peso(totalFiltrado)}</span>
        </p>
      </div>

      {list.length === 0 ? (
        <p className="text-white/30 text-sm">No hay ingresos que coincidan.</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((i) => {
            const abierta = actionsId === i.id || editingId === i.id || confirmDeleteId === i.id;
            return (
              <li key={i.id} className={`bg-white/[0.03] border rounded-xl px-4 py-2.5 transition-colors ${abierta ? "border-green-500/40" : "border-white/8"}`}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm truncate">{i.concepto || i.fuente || "Ingreso"}</p>
                      {i.fuente && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-300">{i.fuente}</span>}
                      {i.recurrente && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 flex items-center gap-1"><Repeat size={9} /> mensual</span>}
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">{fecha(i.fecha)}{i.nota ? ` · ${i.nota}` : ""}</p>
                  </div>
                  <span className="text-sm font-medium text-green-300 flex-shrink-0">{peso(i.monto_mxn)}</span>
                  <button onClick={() => setActionsId((id) => (id === i.id ? null : i.id))} className="text-white/25 hover:text-white shrink-0 p-1" title="Editar / eliminar"><MoreHorizontal size={16} /></button>
                </div>

                {actionsId === i.id && editingId !== i.id && confirmDeleteId !== i.id && (
                  <div className="mt-3 pt-3 border-t border-white/8 flex items-center gap-2">
                    <span className="text-white/40 text-xs mr-auto">Acciones</span>
                    <button onClick={() => abrirEdit(i)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-medium"><Pencil size={13} /> Editar</button>
                    <button onClick={() => { setConfirmDeleteId(i.id); setActionsId(null); }} className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium"><Trash2 size={13} /> Eliminar</button>
                    <button onClick={() => setActionsId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cerrar</button>
                  </div>
                )}

                {editingId === i.id && (
                  <div className="mt-3 pt-3 border-t border-white/8">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div><label className={lblS}>Fecha</label><input type="date" value={ef.fecha} onChange={(ev) => setEf((p) => ({ ...p, fecha: ev.target.value }))} className={inp} /></div>
                      <div><label className={lblS}>Fuente</label><input value={ef.fuente} onChange={(ev) => setEf((p) => ({ ...p, fuente: ev.target.value }))} className={inp} /></div>
                      <div><label className={lblS}>Monto MXN</label><input type="number" step="any" value={ef.monto_mxn} onChange={(ev) => setEf((p) => ({ ...p, monto_mxn: ev.target.value }))} className={inp} /></div>
                      <div className="col-span-2 sm:col-span-3"><label className={lblS}>Concepto</label><input value={ef.concepto} onChange={(ev) => setEf((p) => ({ ...p, concepto: ev.target.value }))} className={inp} /></div>
                    </div>
                    <label className="flex items-center gap-2 mt-2 text-xs text-white/60 cursor-pointer">
                      <input type="checkbox" checked={ef.recurrente} onChange={(ev) => setEf((p) => ({ ...p, recurrente: ev.target.checked }))} className="accent-green-500 w-4 h-4" />
                      Es recurrente (mensual)
                    </label>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => submitEdit(i.id)} disabled={editSaving} className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        {editSaving ? <Loader2 size={13} className="animate-spin" /> : null} Guardar cambios
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cancelar</button>
                      {editErr && <p className="text-red-400 text-xs">{editErr}</p>}
                    </div>
                  </div>
                )}

                {confirmDeleteId === i.id && (
                  <div className="mt-3 pt-3 border-t border-red-500/20 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-white/80">¿Eliminar este ingreso? <span className="text-white/40">No se puede deshacer.</span></p>
                    <div className="flex gap-2 ml-auto">
                      <button onClick={() => doDelete(i.id)} disabled={deleting} className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Sí, eliminar
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-white/50 hover:text-white text-xs px-3 py-1.5">Cancelar</button>
                    </div>
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
