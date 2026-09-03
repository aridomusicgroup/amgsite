"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Loader2, Mail, Phone } from "lucide-react";
import { money } from "@/components/admin/ui";
import { toast } from "@/lib/toast";
import type { ProyectoDetalle } from "@/lib/erp-data";

/**
 * Cliente y venta del proyecto. Registrar un pago se queda aquí (es una
 * acción de un solo campo, igual que en el kanban); editar la venta a fondo
 * o el contacto completo linkea a su editor real en vez de duplicarlo.
 */
export function ClienteVentaTab({ proyecto, isAdmin }: { proyecto: ProyectoDetalle; isAdmin: boolean }) {
  const router = useRouter();
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pf, setPf] = useState({ fecha: new Date().toISOString().slice(0, 10), monto: "", medio: "" });

  const registrarPago = async () => {
    if (!(Number(pf.monto) > 0) || !proyecto.venta_id) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/pagos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venta_id: proyecto.venta_id, fecha: pf.fecha, monto_mxn: pf.monto, medio_pago: pf.medio }),
      });
      if (r.ok) { toast("✓ Pago registrado"); setPaying(false); setPf({ fecha: new Date().toISOString().slice(0, 10), monto: "", medio: "" }); router.refresh(); }
      else toast("⚠️ No se pudo registrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[11px] text-white/35 uppercase tracking-wider mb-2">Cliente</p>
        {proyecto.contacto ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="text-white font-medium">{proyecto.contacto}</p>
              {proyecto.contacto_id && (
                <Link href={`/admin/clientes?destacar=${proyecto.contacto_id}`} className="text-white/30 hover:text-white" title="Ver en CRM">
                  <ExternalLink size={13} />
                </Link>
              )}
            </div>
            {proyecto.contactoEmail && <p className="text-sm text-white/50 flex items-center gap-1.5"><Mail size={12} /> {proyecto.contactoEmail}</p>}
            {proyecto.contactoTelefono && <p className="text-sm text-white/50 flex items-center gap-1.5"><Phone size={12} /> {proyecto.contactoTelefono}</p>}
          </div>
        ) : (
          <p className="text-sm text-white/30">Sin cliente ligado — es un proyecto interno o de catálogo.</p>
        )}
      </div>

      {isAdmin && proyecto.venta_id && (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-white/35 uppercase tracking-wider">Venta</p>
            <Link href="/admin/ventas" className="text-white/30 hover:text-white text-xs flex items-center gap-1">Ver en Ventas <ExternalLink size={12} /></Link>
          </div>
          <div className="flex items-baseline gap-4 mb-3">
            <div><span className="text-white/40 text-xs">Total</span> <span className="text-white font-coolvetica text-lg ml-1">{money(proyecto.ventaTotal)}</span></div>
            <div><span className="text-white/40 text-xs">Saldo</span> <span className={`font-coolvetica text-lg ml-1 ${proyecto.ventaSaldo > 0.5 ? "text-amber-300" : "text-white"}`}>{money(proyecto.ventaSaldo)}</span></div>
          </div>

          {proyecto.pagos.length > 0 && (
            <ul className="space-y-1 mb-3">
              {proyecto.pagos.map((pg) => (
                <li key={pg.id} className="flex items-center justify-between text-xs text-white/60">
                  <span>{new Date(pg.fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} · {pg.medio_pago ?? "—"}</span>
                  <span className="text-white/80">{money(pg.monto_mxn)}</span>
                </li>
              ))}
            </ul>
          )}

          {paying ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="date" value={pf.fecha} onChange={(e) => setPf((p) => ({ ...p, fecha: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-32" />
              <input type="number" value={pf.monto} onChange={(e) => setPf((p) => ({ ...p, monto: e.target.value }))} placeholder="Monto"
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-24" />
              <input value={pf.medio} onChange={(e) => setPf((p) => ({ ...p, medio: e.target.value }))} placeholder="Medio"
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white w-24" />
              <button onClick={registrarPago} disabled={busy} className="bg-lgb-red text-white px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-1">
                {busy ? <Loader2 size={12} className="animate-spin" /> : null} Guardar
              </button>
              <button onClick={() => setPaying(false)} className="text-white/40 text-xs px-1">Cancelar</button>
            </div>
          ) : proyecto.ventaSaldo > 0.5 ? (
            <button onClick={() => setPaying(true)} className="text-xs text-lgb-red hover:underline">+ Registrar pago</button>
          ) : (
            <p className="text-xs text-green-300/70">Liquidado</p>
          )}
        </div>
      )}
    </div>
  );
}
