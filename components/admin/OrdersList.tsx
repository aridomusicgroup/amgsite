"use client";
import { useState, useRef } from "react";
import { ChevronDown, ExternalLink, StickyNote, Pencil, Trash2, Loader2, MoreHorizontal } from "lucide-react";
import { WhatsappIcon } from "@/components/shared/BrandIcons";
import { money } from "@/components/admin/ui";
import { ORDER_STATUSES, STATUS_LABEL, type OrderRow } from "@/lib/admin-data";
import { toast } from "@/lib/toast";

const STATUS_COLOR: Record<string, string> = {
  nuevo: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  en_produccion: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  revision: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  entregado: "bg-green-500/15 text-green-300 border-green-500/30",
  cancelado: "bg-white/5 text-white/40 border-white/10",
};

type OrderPatch = { summary?: string; note?: string; total?: number; type?: "beat" | "servicio"; customer_email?: string };

export function OrdersList({ initialOrders, isAdmin = false }: { initialOrders: OrderRow[]; isAdmin?: boolean }) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<string>("activos");
  const [busy, setBusy] = useState<string | null>(null);

  const changeStatus = async (orderId: string, status: string) => {
    setBusy(orderId);
    const prev = orders;
    setOrders((o) => o.map((x) => (x.id === orderId ? { ...x, status } : x)));
    try {
      const res = await fetch("/api/admin/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });
      if (!res.ok) setOrders(prev);
    } catch {
      setOrders(prev);
    } finally {
      setBusy(null);
    }
  };

  const editOrder = async (id: string, patch: OrderPatch): Promise<string | null> => {
    const { customer_email, ...orderPatch } = patch;
    const prev = orders;
    setOrders((o) =>
      o.map((x) => {
        if (x.id !== id) return x;
        const customers = customer_email && x.customers ? { ...x.customers, email: customer_email } : x.customers;
        return { ...x, ...orderPatch, total: orderPatch.total ?? x.total, customers };
      }),
    );
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) { setOrders(prev); const d = await res.json().catch(() => ({})); return d.error || "No se pudo guardar."; }
      toast("✓ Guardado");
      return null;
    } catch {
      setOrders(prev);
      return "Error de conexión.";
    }
  };

  const deleteOrder = async (id: string): Promise<string | null> => {
    const prev = orders;
    setOrders((o) => o.filter((x) => x.id !== id));
    try {
      const res = await fetch("/api/admin/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { setOrders(prev); const d = await res.json().catch(() => ({})); return d.error || "No se pudo eliminar."; }
      toast("✓ Pedido eliminado");
      return null;
    } catch {
      setOrders(prev);
      return "Error de conexión.";
    }
  };

  const filtered = orders.filter((o) => {
    if (filter === "todos") return true;
    if (filter === "activos") return !["entregado", "cancelado"].includes(o.status);
    return o.status === filter;
  });

  const filters = [
    { id: "activos", label: "Activos" },
    { id: "nuevo", label: "Nuevos" },
    { id: "en_produccion", label: "En producción" },
    { id: "revision", label: "En revisión" },
    { id: "entregado", label: "Entregados" },
    { id: "todos", label: "Todos" },
  ];

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 mb-3">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs border transition-all cursor-pointer ${
              filter === f.id
                ? "bg-lgb-red border-lgb-red text-white"
                : "border-white/15 text-white/50 hover:border-white/30"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isAdmin && (
        <p className="text-white/25 text-[11px] mb-3">Mantén presionado un pedido para editarlo o eliminarlo.</p>
      )}

      {filtered.length === 0 ? (
        <p className="text-white/30 text-sm py-16 text-center">
          No hay pedidos en esta vista.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              busy={busy === o.id}
              isAdmin={isAdmin}
              onChange={(s) => changeStatus(o.id, s)}
              onEdit={(patch) => editOrder(o.id, patch)}
              onDelete={() => deleteOrder(o.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  busy,
  isAdmin,
  onChange,
  onEdit,
  onDelete,
}: {
  order: OrderRow;
  busy: boolean;
  isAdmin: boolean;
  onChange: (status: string) => void;
  onEdit: (patch: OrderPatch) => Promise<string | null>;
  onDelete: () => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [actions, setActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [ef, setEf] = useState({ type: order.type, summary: order.summary ?? "", total: String(order.total ?? ""), note: order.note ?? "", email: order.customers?.email ?? "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  const startPress = (e: React.PointerEvent) => {
    if (!isAdmin) return;
    if ((e.target as HTMLElement).closest("button,input,select,a,label,textarea")) return;
    cancelPress();
    pressTimer.current = setTimeout(() => { setActions(true); setEditing(false); setConfirming(false); }, 600);
  };

  const abrirEdit = () => {
    setEf({ type: order.type, summary: order.summary ?? "", total: String(order.total ?? ""), note: order.note ?? "", email: order.customers?.email ?? "" });
    setActions(false); setEditing(true); setErr(null);
  };
  const guardar = async () => {
    setSaving(true); setErr(null);
    const correoCambio = ef.email.trim().toLowerCase() !== (order.customers?.email ?? "").trim().toLowerCase();
    const e = await onEdit({
      type: ef.type, summary: ef.summary, total: Number(ef.total) || 0, note: ef.note,
      ...(correoCambio && ef.email.trim() ? { customer_email: ef.email.trim() } : {}),
    });
    setSaving(false);
    if (e) setErr(e); else setEditing(false);
  };
  const borrar = async () => {
    setDeleting(true); setErr(null);
    const e = await onDelete();
    setDeleting(false);
    if (e) setErr(e); else setConfirming(false);
  };

  const c = order.customers;
  const phone = c?.phone?.replace(/\D/g, "");
  const date = new Date(order.created_at).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red w-full";
  const lblS = "block text-[10px] text-white/40 mb-1";

  return (
    <div
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={isAdmin ? (e) => e.preventDefault() : undefined}
      className={`rounded-2xl border bg-white/[0.03] overflow-hidden transition-colors ${isAdmin ? "select-none" : ""} ${
        actions || editing || confirming ? "border-lgb-red/40" : "border-white/8"
      }`}
    >
      <div className="p-4">
        {/* Identidad + monto */}
        <div className="flex items-center gap-2.5">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
              order.type === "beat"
                ? "border-lgb-red/30 text-lgb-red"
                : "border-amber-500/30 text-amber-300"
            }`}
          >
            {order.type === "beat" ? "Beat" : "Servicio"}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">
              {c?.name || c?.email || "Cliente"}
            </p>
            <p className="text-white/40 text-xs truncate">
              {order.summary || "—"} · {date}
            </p>
          </div>

          <span className="text-white font-coolvetica shrink-0">
            {money(Number(order.total))}
            <span className="text-white/30 text-[10px] ml-1">{order.currency}</span>
          </span>

          <button
            onClick={() => setOpen(!open)}
            className="text-white/30 hover:text-white p-1 cursor-pointer shrink-0"
          >
            <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Estado + acciones (renglón propio → no se aprieta en móvil) */}
        <div className="mt-2.5 flex items-center gap-2">
          <select
            value={order.status}
            disabled={busy}
            onChange={(e) => onChange(e.target.value)}
            className={`flex-1 sm:flex-none text-xs rounded-full border px-3 py-1.5 cursor-pointer appearance-none text-center focus:outline-none ${
              STATUS_COLOR[order.status] ?? STATUS_COLOR.nuevo
            }`}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s} className="bg-lgb-dark text-white">
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>

          {isAdmin && (
            <button onClick={() => setActions((a) => !a)} className="text-white/30 hover:text-white p-1.5 cursor-pointer shrink-0" title="Editar / eliminar">
              <MoreHorizontal size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Barra de acciones (long-press) */}
      {actions && !editing && !confirming && (
        <div className="border-t border-white/8 px-4 py-3 flex items-center gap-2">
          <span className="text-white/40 text-xs mr-auto">Acciones</span>
          <button onClick={abrirEdit} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
            <Pencil size={13} /> Editar
          </button>
          <button onClick={() => { setConfirming(true); setActions(false); setErr(null); }} className="flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium">
            <Trash2 size={13} /> Eliminar
          </button>
          <button onClick={() => setActions(false)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cerrar</button>
        </div>
      )}

      {/* Formulario de edición */}
      {editing && (
        <div className="border-t border-white/8 px-4 py-3 select-text">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className={lblS}>Tipo</label>
              <select value={ef.type} onChange={(e) => setEf((p) => ({ ...p, type: e.target.value as "beat" | "servicio" }))} className={inp}>
                <option value="beat" className="bg-lgb-dark">Beat</option>
                <option value="servicio" className="bg-lgb-dark">Servicio</option>
              </select>
            </div>
            <div>
              <label className={lblS}>Total ({order.currency})</label>
              <input type="number" step="any" value={ef.total} onChange={(e) => setEf((p) => ({ ...p, total: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={lblS}>Concepto</label>
              <input value={ef.summary} onChange={(e) => setEf((p) => ({ ...p, summary: e.target.value }))} className={inp} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className={lblS}>Nota interna</label>
              <input value={ef.note} onChange={(e) => setEf((p) => ({ ...p, note: e.target.value }))} placeholder="—" className={inp} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className={lblS}>Correo del cliente (acceso a su panel)</label>
              <input type="email" value={ef.email} onChange={(e) => setEf((p) => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" className={inp} />
              <p className="text-white/30 text-[10px] mt-1">Cámbialo solo si se capturó mal — mueve el pedido y la contraseña (si ya tenía) al correo correcto.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={guardar} disabled={saving}
              className="flex items-center gap-1.5 bg-lgb-red text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              Guardar cambios
            </button>
            <button onClick={() => setEditing(false)} className="text-white/40 hover:text-white text-xs px-2 py-1.5">Cancelar</button>
            {err && <p className="text-red-400 text-xs">{err}</p>}
          </div>
        </div>
      )}

      {/* Confirmación de borrado */}
      {confirming && (
        <div className="border-t border-red-500/20 px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-white/80">
            ¿Eliminar este pedido? <span className="text-white/40">No se puede deshacer.</span>
          </p>
          <div className="flex gap-2 ml-auto">
            <button onClick={borrar} disabled={deleting}
              className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Sí, eliminar
            </button>
            <button onClick={() => setConfirming(false)} className="text-white/50 hover:text-white text-xs px-3 py-1.5">Cancelar</button>
          </div>
          {err && <p className="text-red-400 text-xs w-full">{err}</p>}
        </div>
      )}

      {open && (
        <div className="border-t border-white/5 px-4 py-3 bg-black/20 flex flex-col gap-2 text-sm">
          <Detail label="Email" value={c?.email ?? "—"} />
          <Detail label="Teléfono" value={c?.phone ?? "no dejó"} />
          <Detail label="Concepto" value={order.summary ?? "—"} />
          {order.note && (
            <div className="flex gap-2 text-white/60">
              <StickyNote size={14} className="text-amber-300 shrink-0 mt-0.5" />
              <span className="italic">{order.note}</span>
            </div>
          )}
          {order.utm_source && <Detail label="Origen" value={order.utm_source} />}
          <div className="flex gap-2 mt-1">
            {phone && (
              <a
                href={`https://wa.me/${phone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 px-3 py-1.5 rounded-full text-xs hover:bg-[#25D366]/25 transition-colors"
              >
                <WhatsappIcon size={12} />
                WhatsApp
              </a>
            )}
            {c?.email && (
              <a
                href={`mailto:${c.email}`}
                className="inline-flex items-center gap-1.5 bg-white/5 text-white/60 border border-white/10 px-3 py-1.5 rounded-full text-xs hover:text-white transition-colors"
              >
                <ExternalLink size={11} />
                Email
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-white/40 w-20 shrink-0">{label}</span>
      <span className="text-white/80 break-all">{value}</span>
    </div>
  );
}
