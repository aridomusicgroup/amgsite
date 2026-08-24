"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Pencil, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toast";

interface PagoCliente {
  id: string;
  fecha: string | null;
  monto_mxn: number;
  tipo: string | null;
  medio_pago: string | null;
  notas: string | null;
}

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

const TIPO_COLOR: Record<string, string> = {
  anticipo: "bg-amber-500/15 text-amber-300",
  abono: "bg-amber-500/15 text-amber-300",
  finiquito: "bg-green-500/15 text-green-300",
  completo: "bg-green-500/15 text-green-300",
};

/**
 * Lo que el CLIENTE ha pagado de esta venta: verlo y corregirlo.
 *
 * Antes solo se podían registrar pagos; si te equivocabas de monto, fecha o
 * medio, no había forma de arreglarlo y el saldo quedaba mal para siempre.
 */
export function PagosClienteSection({ ventaId }: { ventaId: string }) {
  const router = useRouter();
  const [pagos, setPagos] = useState<PagoCliente[] | null>(null);
  const [resumen, setResumen] = useState<{ total: number; cobrado: number; saldo: number } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState({ fecha: "", monto: "", medio: "" });
  const [busy, setBusy] = useState(false);

  const inp =
    "bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-lgb-red";

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/pagos?venta_id=${encodeURIComponent(ventaId)}`);
      const d = await r.json();
      if (r.ok) {
        setPagos(d.pagos ?? []);
        setResumen({ total: d.total ?? 0, cobrado: d.cobrado ?? 0, saldo: d.saldo ?? 0 });
      } else setPagos([]);
    } catch {
      setPagos([]);
    }
  }, [ventaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirEdit = (p: PagoCliente) => {
    setEditId(p.id);
    setF({ fecha: p.fecha ?? "", monto: String(Math.round(p.monto_mxn)), medio: p.medio_pago ?? "" });
  };

  const guardar = async (id: string) => {
    if (!(Number(f.monto) > 0)) { toast("Pon un monto válido"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/pagos", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, fecha: f.fecha, monto_mxn: f.monto, medio_pago: f.medio }),
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "No se pudo guardar"); return; }
      setEditId(null);
      await cargar();
      router.refresh(); // el saldo y las finanzas se recalculan del lado del servidor
      toast(d.liquidada ? "✓ Corregido — la venta queda liquidada" : `✓ Corregido · saldo ${peso(d.saldo)}`);
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  const borrar = async (p: PagoCliente) => {
    // Sin ningún pago, una venta se cuenta como cobrada al 100% (así están las
    // históricas). Borrar el último NO la deja "sin cobrar": la da por pagada.
    const ultimo = (pagos ?? []).length === 1;
    const aviso = ultimo
      ? `¿Eliminar el pago de ${peso(p.monto_mxn)}?\n\nOJO: es el único pago de esta venta. Sin pagos registrados, el sistema la cuenta como COBRADA AL 100% y desaparecerá de "por cobrar".`
      : `¿Eliminar el pago de ${peso(p.monto_mxn)}?`;
    if (!confirm(aviso)) return;

    setBusy(true);
    try {
      const r = await fetch(`/api/admin/pagos?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "No se pudo eliminar"); return; }
      await cargar();
      router.refresh();
      toast(d.sinPagos ? "Eliminado — la venta vuelve a contar como cobrada al 100%" : "✓ Pago eliminado");
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  if (pagos !== null && pagos.length === 0) return null; // sin pagos no hay nada que corregir

  return (
    <div className="mt-3 pt-3 border-t border-white/8 select-text">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-white/70">💵 Pagos del cliente</p>
        {resumen && (
          <p className="text-[11px] text-white/50">
            Cobrado <span className="text-white/80">{peso(resumen.cobrado)}</span> de {peso(resumen.total)}
            {resumen.saldo > 0.5 && <span className="text-amber-300"> · falta {peso(resumen.saldo)}</span>}
          </p>
        )}
      </div>

      {pagos === null ? (
        <p className="text-white/30 text-xs flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Cargando…</p>
      ) : (
        <ul className="space-y-1.5">
          {pagos.map((p) => (
            <li key={p.id} className="text-xs bg-white/[0.03] rounded-lg px-2.5 py-1.5">
              {editId === p.id ? (
                <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
                  <input type="date" value={f.fecha} onChange={(e) => setF((s) => ({ ...s, fecha: e.target.value }))} className={`${inp} w-full sm:w-auto`} />
                  <input type="number" step="any" value={f.monto} onChange={(e) => setF((s) => ({ ...s, monto: e.target.value }))} placeholder="Monto" className={`${inp} w-full sm:w-24`} />
                  <input value={f.medio} onChange={(e) => setF((s) => ({ ...s, medio: e.target.value }))} placeholder="Medio" className={`${inp} w-full col-span-2 sm:w-28`} />
                  <div className="col-span-2 flex items-center gap-1 sm:ml-auto">
                    <button onClick={() => guardar(p.id)} disabled={busy}
                      className="flex items-center gap-1 bg-lgb-red text-white px-2.5 py-1 rounded-lg text-[11px] font-medium hover:bg-red-700 disabled:opacity-50">
                      {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Guardar
                    </button>
                    <button onClick={() => setEditId(null)} className="text-white/40 hover:text-white p-1"><X size={13} /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${TIPO_COLOR[p.tipo ?? ""] ?? "bg-white/10 text-white/50"}`}>
                    {p.tipo ?? "pago"}
                  </span>
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    {p.fecha && <span className="text-white/50 shrink-0">{p.fecha.slice(5)}</span>}
                    {p.medio_pago && <span className="text-white/35 truncate">{p.medio_pago}</span>}
                  </div>
                  <span className="text-white font-medium shrink-0">{peso(p.monto_mxn)}</span>
                  <button onClick={() => abrirEdit(p)} className="text-white/25 hover:text-white shrink-0 p-1" title="Corregir este pago">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => borrar(p)} disabled={busy} className="text-white/25 hover:text-red-300 shrink-0 p-1 disabled:opacity-40" title="Eliminar">
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {resumen && resumen.cobrado > resumen.total + 0.5 && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-300/80 mt-2">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          Los pagos suman {peso(resumen.cobrado)}, más que el total de {peso(resumen.total)}. Revisa si hay uno duplicado.
        </p>
      )}
    </div>
  );
}
