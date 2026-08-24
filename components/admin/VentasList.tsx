"use client";
import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import type { Venta } from "@/lib/erp-data";
import { toast } from "@/lib/toast";
import { PagosMusicoSection } from "./PagosMusicoSection";
import { PagosClienteSection } from "./PagosClienteSection";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const hoy = () => new Date().toISOString().slice(0, 10);
const fecha = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });

const CANAL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  tiktok: "TikTok",
  beatstars: "BeatStars",
  facebook: "Facebook",
  sitio: "Sitio web",
};

const CANAL_STYLE: Record<string, string> = {
  whatsapp: "bg-green-500/15 text-green-300",
  instagram: "bg-pink-500/15 text-pink-300",
  tiktok: "bg-white/10 text-white/60",
  beatstars: "bg-amber-500/15 text-amber-300",
};

const CANALES = ["whatsapp", "instagram", "beatstars", "tiktok", "facebook", "sitio"];

const mesLabel = (k: string) =>
  new Date(k + "-15T12:00:00").toLocaleDateString("es-MX", { month: "long", year: "numeric" });

export function VentasList({ ventas }: { ventas: Venta[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [canal, setCanal] = useState("todos");
  const [mes, setMes] = useState("todos");
  const [soloPorCobrar, setSoloPorCobrar] = useState(false);

  // Cobro inline (finiquito / abono)
  const [payingId, setPayingId] = useState<string | null>(null);
  const [pf, setPf] = useState({ fecha: hoy(), monto: "", medio: "" });
  const [pagoSaving, setPagoSaving] = useState(false);
  const [pagoErr, setPagoErr] = useState<string | null>(null);

  // Acciones por long-press (editar / eliminar) — solo admins llegan a esta página
  const [actionsId, setActionsId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ef, setEf] = useState({ fecha: "", tipo: "", beat_nombre: "", canal: "", total_mxn: "", medio_pago: "", quien_cerro: "" });
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
    if ((e.target as HTMLElement).closest("button,input,select,a,label")) return; // no sobre controles
    cancelPress();
    pressTimer.current = setTimeout(() => {
      setActionsId(id); setPayingId(null); setEditingId(null); setConfirmDeleteId(null);
    }, 600);
  };

  const canales = useMemo(() => {
    const s = new Set<string>();
    for (const v of ventas) if (v.canal) s.add(v.canal);
    return ["todos", ...s];
  }, [ventas]);

  const meses = useMemo(() => {
    const s = new Set<string>();
    for (const v of ventas) if (v.fecha) s.add(v.fecha.slice(0, 7));
    return ["todos", ...[...s].sort((a, b) => b.localeCompare(a))];
  }, [ventas]);

  const porCobrarCount = useMemo(() => ventas.filter((v) => v.saldo > 0.5).length, [ventas]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return ventas.filter((v) => {
      if (soloPorCobrar && v.saldo <= 0.5) return false;
      if (canal !== "todos" && v.canal !== canal) return false;
      if (mes !== "todos" && (v.fecha ?? "").slice(0, 7) !== mes) return false;
      if (!term) return true;
      return (
        (v.cliente ?? "").toLowerCase().includes(term) ||
        (v.beat_nombre ?? "").toLowerCase().includes(term) ||
        (v.tipo ?? "").toLowerCase().includes(term) ||
        (v.folio ?? "").toLowerCase().includes(term)
      );
    });
  }, [ventas, q, canal, mes, soloPorCobrar]);

  const totalFiltrado = list.reduce((a, v) => a + v.total_mxn, 0);
  const saldoFiltrado = list.reduce((a, v) => a + v.saldo, 0);

  const abrirPago = (v: Venta) => {
    setPayingId(v.id); setActionsId(null);
    setPf({ fecha: hoy(), monto: String(Math.round(v.saldo)), medio: v.medio_pago ?? "" });
    setPagoErr(null);
  };

  const submitPago = async (ventaId: string) => {
    setPagoSaving(true); setPagoErr(null);
    try {
      const r = await fetch("/api/admin/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venta_id: ventaId, fecha: pf.fecha, monto_mxn: pf.monto, medio_pago: pf.medio }),
      });
      const d = await r.json();
      if (!r.ok) setPagoErr(d.error || "No se pudo guardar.");
      else { setPayingId(null); router.refresh(); toast("✓ Pago registrado"); }
    } catch {
      setPagoErr("Error de conexión.");
    } finally {
      setPagoSaving(false);
    }
  };

  const abrirEdit = (v: Venta) => {
    setEditingId(v.id); setActionsId(null);
    setEf({
      fecha: v.fecha || "",
      tipo: v.tipo || "",
      beat_nombre: v.beat_nombre || "",
      canal: v.canal || "",
      total_mxn: String(v.total_mxn ?? ""),
      medio_pago: v.medio_pago || "",
      quien_cerro: v.quien_cerro || "",
    });
    setEditErr(null);
  };
  const setE = (k: keyof typeof ef) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEf((p) => ({ ...p, [k]: e.target.value }));

  const submitEdit = async (id: string) => {
    setEditSaving(true); setEditErr(null);
    try {
      const r = await fetch("/api/admin/ventas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...ef }),
      });
      const d = await r.json();
      if (!r.ok) setEditErr(d.error || "No se pudo guardar.");
      else { setEditingId(null); router.refresh(); toast("✓ Guardado"); }
    } catch {
      setEditErr("Error de conexión.");
    } finally {
      setEditSaving(false);
    }
  };

  const doDelete = async (id: string) => {
    setDeleting(true); setDeleteErr(null);
    try {
      const r = await fetch("/api/admin/ventas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) setDeleteErr(d.error || "No se pudo eliminar.");
      else { setConfirmDeleteId(null); router.refresh(); toast("✓ Venta eliminada"); }
    } catch {
      setDeleteErr("Error de conexión.");
    } finally {
      setDeleting(false);
    }
  };

  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";
  const lblS = "block text-[10px] text-white/40 mb-1";

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, beat, tipo o folio…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {canales.map((c) => (
            <button
              key={c}
              onClick={() => setCanal(c)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                canal === c ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"
              }`}
            >
              {c === "todos" ? "Todos" : CANAL_LABEL[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-lgb-red capitalize"
          >
            {meses.map((m) => (
              <option key={m} value={m} className="bg-lgb-dark capitalize">
                {m === "todos" ? "Todos los meses" : mesLabel(m)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSoloPorCobrar((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
              soloPorCobrar ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40" : "bg-white/5 text-white/50 hover:text-white"
            }`}
          >
            Por cobrar{porCobrarCount > 0 ? ` · ${porCobrarCount}` : ""}
          </button>
        </div>
        <p className="text-white/40 text-xs">
          {list.length} ventas · <span className="text-white/70 font-medium">{peso(totalFiltrado)}</span>
          {saldoFiltrado > 0.5 && (
            <> · <span className="text-amber-300/90 font-medium">{peso(saldoFiltrado)} por cobrar</span></>
          )}
        </p>
      </div>

      <p className="text-white/25 text-[11px] mb-2">Mantén presionada una venta para editarla o eliminarla.</p>

      <ul className="space-y-2">
        {list.map((v) => {
          const pendiente = v.saldo > 0.5;
          const abierta = actionsId === v.id || editingId === v.id || confirmDeleteId === v.id;
          return (
            <li
              key={v.id}
              onPointerDown={(e) => startPress(e, v.id)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => e.preventDefault()}
              className={`bg-white/[0.03] border rounded-xl px-4 py-3 select-none transition-colors ${abierta ? "border-lgb-red/40" : "border-white/8"}`}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{v.beat_nombre || v.tipo || "Venta"}</p>
                    {v.canal && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${CANAL_STYLE[v.canal] ?? "bg-white/10 text-white/50"}`}>
                        {CANAL_LABEL[v.canal] ?? v.canal}
                      </span>
                    )}
                    {pendiente && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                        {v.estadoPago === "parcial" ? "Anticipo" : "Sin pago"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-white/40 text-xs flex-wrap">
                    <span>{fecha(v.fecha)}</span>
                    {v.cliente && <span>· {v.cliente}</span>}
                    {v.tipo && v.beat_nombre && <span>· {v.tipo}</span>}
                    {v.quien_cerro && <span>· cerró {v.quien_cerro}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium">{peso(v.total_mxn)}</p>
                  {pendiente ? (
                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                      <span className="text-amber-300 text-[10px]" title={`cobrado ${peso(v.cobrado)} de ${peso(v.total_mxn)}`}>
                        saldo {peso(v.saldo)}
                      </span>
                      {payingId !== v.id && (
                        <button
                          onClick={() => abrirPago(v)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-lgb-red/80 text-white hover:bg-lgb-red"
                        >
                          Registrar pago
                        </button>
                      )}
                    </div>
                  ) : v.comision > 0 ? (
                    <p className="text-green-300/80 text-[10px]" title={`bruto ${peso(v.total_mxn)} − comisión ${peso(v.comision)}`}>
                      neto {peso(v.neto)}
                    </p>
                  ) : (
                    v.medio_pago && <p className="text-white/30 text-[10px]">{v.medio_pago}</p>
                  )}
                </div>
                <button onClick={() => setActionsId((id) => (id === v.id ? null : v.id))} className="text-white/25 hover:text-white shrink-0 p-1" title="Editar / eliminar">
                  <MoreHorizontal size={16} />
                </button>
              </div>

              {/* Cobro inline */}
              {payingId === v.id && (
                <div className="mt-3 pt-3 border-t border-white/8 flex flex-wrap items-end gap-2 select-text">
                  <div>
                    <label className={lblS}>Fecha del pago</label>
                    <input type="date" value={pf.fecha} onChange={(e) => setPf((p) => ({ ...p, fecha: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className={lblS}>Monto (MXN)</label>
                    <input type="number" step="any" value={pf.monto} onChange={(e) => setPf((p) => ({ ...p, monto: e.target.value }))} className={`${inp} w-28`} />
                  </div>
                  <div>
                    <label className={lblS}>Medio</label>
                    <input value={pf.medio} onChange={(e) => setPf((p) => ({ ...p, medio: e.target.value }))} placeholder="ZELLE" className={`${inp} w-28`} />
                  </div>
                  <button
                    onClick={() => submitPago(v.id)}
                    disabled={pagoSaving}
                    className="flex items-center gap-1.5 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {pagoSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                    Guardar pago
                  </button>
                  <button onClick={() => setPayingId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cancelar</button>
                  {pagoErr && <p className="text-red-400 text-xs w-full">{pagoErr}</p>}
                </div>
              )}

              {/* Barra de acciones (long-press) + pagos a músicos */}
              {actionsId === v.id && editingId !== v.id && confirmDeleteId !== v.id && (
                <>
                  <div className="mt-3 pt-3 border-t border-white/8 flex items-center gap-2">
                    <span className="text-white/40 text-xs mr-auto">Acciones</span>
                    <button onClick={() => abrirEdit(v)} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                      <Pencil size={13} /> Editar
                    </button>
                    <button onClick={() => { setConfirmDeleteId(v.id); setActionsId(null); setDeleteErr(null); }} className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium">
                      <Trash2 size={13} /> Eliminar
                    </button>
                    <button onClick={() => setActionsId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cerrar</button>
                  </div>
                  <PagosClienteSection ventaId={v.id} />
                  <PagosMusicoSection ventaId={v.id} extras={v.extras} />
                </>
              )}

              {/* Formulario de edición */}
              {editingId === v.id && (
                <div className="mt-3 pt-3 border-t border-white/8 select-text">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className={lblS}>Fecha</label>
                      <input type="date" value={ef.fecha} onChange={setE("fecha")} className={`${inp} w-full`} />
                    </div>
                    <div>
                      <label className={lblS}>Tipo</label>
                      <input value={ef.tipo} onChange={setE("tipo")} className={`${inp} w-full`} />
                    </div>
                    <div>
                      <label className={lblS}>Beat / proyecto</label>
                      <input value={ef.beat_nombre} onChange={setE("beat_nombre")} className={`${inp} w-full`} />
                    </div>
                    <div>
                      <label className={lblS}>Canal</label>
                      <select value={ef.canal} onChange={setE("canal")} className={`${inp} w-full`}>
                        <option value="" className="bg-lgb-dark">—</option>
                        {CANALES.map((c) => <option key={c} value={c} className="bg-lgb-dark">{CANAL_LABEL[c]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lblS}>Total MXN</label>
                      <input type="number" step="any" value={ef.total_mxn} onChange={setE("total_mxn")} className={`${inp} w-full`} />
                    </div>
                    <div>
                      <label className={lblS}>Medio de pago</label>
                      <input value={ef.medio_pago} onChange={setE("medio_pago")} className={`${inp} w-full`} />
                    </div>
                    <div>
                      <label className={lblS}>Quién cerró</label>
                      <input value={ef.quien_cerro} onChange={setE("quien_cerro")} className={`${inp} w-full`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => submitEdit(v.id)}
                      disabled={editSaving}
                      className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {editSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                      Guardar cambios
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cancelar</button>
                    {editErr && <p className="text-red-400 text-xs">{editErr}</p>}
                  </div>
                </div>
              )}

              {/* Confirmación de borrado */}
              {confirmDeleteId === v.id && (
                <div className="mt-3 pt-3 border-t border-red-500/20 flex flex-wrap items-center gap-3">
                  <p className="text-sm text-white/80">
                    ¿Eliminar esta venta? <span className="text-white/40">No se puede deshacer.</span>
                  </p>
                  <div className="flex gap-2 ml-auto">
                    <button
                      onClick={() => doDelete(v.id)}
                      disabled={deleting}
                      className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                    >
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

      {list.length === 0 && (
        <p className="text-white/30 text-sm text-center py-8">No hay ventas que coincidan.</p>
      )}
    </div>
  );
}
