"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "@/lib/toast";

interface Resultado {
  resumen: { enlazados: number; avisados: number; sinCorreo: number; sinContacto: number };
  enlazados: string[];
  avisados: string[];
  sinCorreo: string[];
  sinContacto: string[];
}

/**
 * Enlaza los proyectos de PRODUCCIÓN de cliente que aún no tienen pedido (para
 * que el cliente los vea en /cuenta) y avisa por correo a los que siguen activos.
 * Idempotente: se puede correr las veces que haga falta. Solo admin.
 */
export function SyncPedidosButton() {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);

  async function run() {
    setBusy(true);
    setConfirm(false);
    try {
      const r = await fetch("/api/admin/proyectos/backfill-pedidos", { method: "POST" });
      const d = await r.json();
      if (!r.ok) {
        toast(d.error || "Error al sincronizar");
        return;
      }
      setRes(d);
      toast(`✓ ${d.resumen.enlazados} enlazados · ${d.resumen.avisados} avisados`);
    } catch {
      toast("Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {!confirm ? (
        <button
          onClick={() => setConfirm(true)}
          disabled={busy}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/25 rounded-lg px-3 py-1.5 disabled:opacity-50"
        >
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
          {busy ? "Sincronizando…" : "Sincronizar proyectos de cliente"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-white/50">Enlaza proyectos de cliente sin pedido y avisa por correo a los activos.</span>
          <button onClick={run} className="bg-lgb-red text-white rounded-lg px-3 py-1.5 font-medium">
            Sí, sincronizar
          </button>
          <button onClick={() => setConfirm(false)} className="text-white/40 px-2">
            Cancelar
          </button>
        </div>
      )}

      {res && (
        <div className="mt-3 text-xs bg-white/[0.03] border border-white/8 rounded-lg p-3 space-y-1.5">
          <p className="text-green-300">
            ✓ {res.resumen.enlazados} proyecto(s) enlazado(s)
            {res.enlazados.length ? `: ${res.enlazados.join(", ")}` : ""}
          </p>
          {res.resumen.avisados > 0 && (
            <p className="text-blue-300">📧 {res.resumen.avisados} cliente(s) avisado(s) por correo</p>
          )}
          {res.sinCorreo.length > 0 && (
            <p className="text-amber-300">
              ⚠️ Falta correo (agrégalo en el proyecto/CRM y vuelve a sincronizar): {res.sinCorreo.join(", ")}
            </p>
          )}
          {res.sinContacto.length > 0 && (
            <p className="text-white/40">❌ Sin cliente asignado: {res.sinContacto.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
