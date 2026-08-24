"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2, MoreHorizontal, PauseCircle, PlayCircle, CircleDollarSign } from "lucide-react";
import type { GastoRecurrenteRow } from "@/lib/gastos-recurrentes-data";
import { toast } from "@/lib/toast";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const hoy = () => new Date().toISOString().slice(0, 10);
const fechaCorta = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });

export function GastosRecurrentesList({ gastos }: { gastos: GastoRecurrenteRow[] }) {
  const router = useRouter();
  const [actionsId, setActionsId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ef, setEf] = useState({ nombre: "", categoria: "", proveedor: "", monto_estimado: "", dia_mes: "", notas: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const [pf, setPf] = useState({ fecha: hoy(), monto: "", medio: "" });
  const [pagando, setPagando] = useState(false);
  const [pagarErr, setPagarErr] = useState<string | null>(null);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };
  const startPress = (e: React.PointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest("button,input,select,a,label")) return;
    cancelPress();
    pressTimer.current = setTimeout(() => { setActionsId(id); setEditingId(null); setConfirmDeleteId(null); setPagandoId(null); }, 600);
  };

  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red w-full";
  const lblS = "block text-[10px] text-white/40 mb-1";

  const abrirEdit = (g: GastoRecurrenteRow) => {
    setEditingId(g.id); setActionsId(null);
    setEf({
      nombre: g.nombre, categoria: g.categoria || "", proveedor: g.proveedor || "",
      monto_estimado: String(g.montoEstimado ?? ""), dia_mes: String(g.diaMes ?? ""), notas: g.notas || "",
    });
    setEditErr(null);
  };

  const submitEdit = async (id: string) => {
    setEditSaving(true); setEditErr(null);
    try {
      const r = await fetch("/api/admin/gastos-recurrentes", {
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

  const togglePausa = async (g: GastoRecurrenteRow) => {
    try {
      const r = await fetch("/api/admin/gastos-recurrentes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: g.id, activo: !g.activo }),
      });
      if (r.ok) { setActionsId(null); router.refresh(); toast(g.activo ? "⏸ Pausado" : "▶️ Reactivado"); }
    } catch { /* silencioso, el botón se puede reintentar */ }
  };

  const doDelete = async (id: string) => {
    setDeleting(true);
    try {
      const r = await fetch("/api/admin/gastos-recurrentes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (r.ok) { setConfirmDeleteId(null); router.refresh(); toast("✓ Eliminado"); }
    } catch { /* silencioso */ }
    finally { setDeleting(false); }
  };

  const abrirPagar = (g: GastoRecurrenteRow) => {
    setPagandoId(g.id); setActionsId(null);
    setPf({ fecha: hoy(), monto: String(Math.round(g.montoEstimado || 0)), medio: "" });
    setPagarErr(null);
  };

  const confirmarPago = async (g: GastoRecurrenteRow) => {
    setPagando(true); setPagarErr(null);
    try {
      const r = await fetch("/api/admin/egresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: pf.fecha,
          // OJO: categoria va TAL CUAL (sin caer a g.nombre) y proveedor cae
          // a g.nombre — es exactamente la combinación que arma la clave de
          // "¿ya se pagó?" en lib/gastos-recurrentes-data.ts. Si no coincide
          // exacto, el aviso nunca se apaga aunque ya se haya marcado pagado
          // (bug real, ver Google One: categoria null vs "Google One").
          categoria: g.categoria,
          proveedor: g.proveedor || g.nombre,
          descripcion: `Pago recurrente: ${g.nombre}${pf.medio ? ` (${pf.medio})` : ""}`,
          total_mxn: pf.monto,
        }),
      });
      const d = await r.json();
      if (!r.ok) setPagarErr(d.error || "No se pudo registrar.");
      else { setPagandoId(null); router.refresh(); toast("✓ Pago registrado"); }
    } catch { setPagarErr("Error de conexión."); }
    finally { setPagando(false); }
  };

  if (gastos.length === 0) {
    return <p className="text-white/30 text-sm">Ningún pago recurrente registrado todavía.</p>;
  }

  return (
    <div>
      <p className="text-white/25 text-[11px] mb-2">Mantén presionado uno para editarlo, pausarlo o eliminarlo.</p>
      <ul className="space-y-1.5">
        {gastos.map((g) => {
          const abierta = actionsId === g.id || editingId === g.id || confirmDeleteId === g.id || pagandoId === g.id;
          return (
            <li
              key={g.id}
              onPointerDown={(ev) => startPress(ev, g.id)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(ev) => ev.preventDefault()}
              className={`bg-white/[0.03] border rounded-xl px-4 py-2.5 select-none transition-colors ${abierta ? "border-lgb-red/40" : g.pendiente ? "border-amber-400/30" : "border-white/8"} ${!g.activo ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm truncate">{g.nombre}</p>
                    {!g.activo && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">pausado</span>}
                    {g.activo && g.pendiente && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                        {g.proximaFecha && g.proximaFecha < hoy() ? "vencido" : "por vencer"}
                      </span>
                    )}
                  </div>
                  <p className="text-white/40 text-xs mt-0.5">
                    día {g.diaMes}{g.proveedor ? ` · ${g.proveedor}` : ""}{g.activo && g.proximaFecha ? ` · vence ${fechaCorta(g.proximaFecha)}` : ""}
                  </p>
                </div>
                <span className="text-sm font-medium flex-shrink-0">{peso(g.montoEstimado)}</span>
                <button onClick={() => setActionsId((id) => (id === g.id ? null : g.id))} className="text-white/25 hover:text-white shrink-0 p-1" title="Acciones"><MoreHorizontal size={16} /></button>
              </div>

              {actionsId === g.id && editingId !== g.id && confirmDeleteId !== g.id && pagandoId !== g.id && (
                <div className="mt-3 pt-3 border-t border-white/8 flex items-center gap-2 flex-wrap">
                  <span className="text-white/40 text-xs mr-auto">Acciones</span>
                  {g.activo && g.pendiente && (
                    <button onClick={() => abrirPagar(g)} className="flex items-center gap-1.5 bg-lgb-red/15 hover:bg-lgb-red/25 text-lgb-red px-3 py-1.5 rounded-lg text-xs font-medium">
                      <CircleDollarSign size={13} /> Marcar pagado
                    </button>
                  )}
                  <button onClick={() => abrirEdit(g)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                    <Pencil size={13} /> Editar
                  </button>
                  <button onClick={() => togglePausa(g)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                    {g.activo ? <PauseCircle size={13} /> : <PlayCircle size={13} />} {g.activo ? "Pausar" : "Reactivar"}
                  </button>
                  <button onClick={() => { setConfirmDeleteId(g.id); setActionsId(null); }} className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium">
                    <Trash2 size={13} /> Eliminar
                  </button>
                  <button onClick={() => setActionsId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cerrar</button>
                </div>
              )}

              {editingId === g.id && (
                <div className="mt-3 pt-3 border-t border-white/8 select-text">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className={lblS}>Nombre</label>
                      <input value={ef.nombre} onChange={(ev) => setEf((p) => ({ ...p, nombre: ev.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className={lblS}>Día del mes</label>
                      <input type="number" min={1} max={31} value={ef.dia_mes} onChange={(ev) => setEf((p) => ({ ...p, dia_mes: ev.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className={lblS}>Categoría</label>
                      <input value={ef.categoria} onChange={(ev) => setEf((p) => ({ ...p, categoria: ev.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className={lblS}>Proveedor</label>
                      <input value={ef.proveedor} onChange={(ev) => setEf((p) => ({ ...p, proveedor: ev.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className={lblS}>Monto estimado</label>
                      <input type="number" step="any" value={ef.monto_estimado} onChange={(ev) => setEf((p) => ({ ...p, monto_estimado: ev.target.value }))} className={inp} />
                    </div>
                    <div className="col-span-2 sm:col-span-3">
                      <label className={lblS}>Notas</label>
                      <input value={ef.notas} onChange={(ev) => setEf((p) => ({ ...p, notas: ev.target.value }))} className={inp} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => submitEdit(g.id)} disabled={editSaving}
                      className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                      {editSaving ? <Loader2 size={13} className="animate-spin" /> : null} Guardar cambios
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cancelar</button>
                    {editErr && <p className="text-red-400 text-xs">{editErr}</p>}
                  </div>
                </div>
              )}

              {pagandoId === g.id && (
                <div className="mt-3 pt-3 border-t border-white/8 select-text">
                  <p className="text-xs text-white/50 mb-2">Registra el pago real de este ciclo — se guarda como egreso.</p>
                  <div className="flex flex-wrap items-end gap-1.5">
                    <div>
                      <label className={lblS}>Fecha</label>
                      <input type="date" value={pf.fecha} onChange={(ev) => setPf((p) => ({ ...p, fecha: ev.target.value }))} className={inp} />
                    </div>
                    <div>
                      <label className={lblS}>Monto</label>
                      <input type="number" step="any" value={pf.monto} onChange={(ev) => setPf((p) => ({ ...p, monto: ev.target.value }))} className={`${inp} w-24`} />
                    </div>
                    <div>
                      <label className={lblS}>Medio</label>
                      <input value={pf.medio} onChange={(ev) => setPf((p) => ({ ...p, medio: ev.target.value }))} placeholder="transferencia" className={`${inp} w-28`} />
                    </div>
                    <button onClick={() => confirmarPago(g)} disabled={pagando} className="bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                      {pagando ? "Guardando…" : "Confirmar"}
                    </button>
                    <button onClick={() => setPagandoId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cancelar</button>
                  </div>
                  {pagarErr && <p className="text-red-400 text-xs mt-2">{pagarErr}</p>}
                </div>
              )}

              {confirmDeleteId === g.id && (
                <div className="mt-3 pt-3 border-t border-red-500/20 flex flex-wrap items-center gap-3">
                  <p className="text-sm text-white/80">¿Eliminar "{g.nombre}"? <span className="text-white/40">No se puede deshacer.</span></p>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => doDelete(g.id)} disabled={deleting}
                      className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
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
    </div>
  );
}
