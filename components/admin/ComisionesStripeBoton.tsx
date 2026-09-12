"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/lib/toast";

/**
 * Trae de Stripe las comisiones que quedaron vacías (el cron lo hace solo cada
 * día; esto es para no esperar). Con eso el neto de la venta y Finanzas cuadran.
 */
export function ComisionesStripeBoton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const correr = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/comisiones-stripe", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo"}`); return; }
      toast(d.completadas
        ? `✓ ${d.completadas} comisión(es) de Stripe registrada(s)${d.pendientes ? ` · ${d.pendientes} sin dato todavía` : ""}`
        : d.pendientes
          ? `Stripe aún no da la comisión de ${d.pendientes} pago(s); se reintenta solo cada día`
          : "✓ No faltaba ninguna");
      router.refresh();
    } catch { toast("Error de red"); } finally { setBusy(false); }
  };

  return (
    <button onClick={correr} disabled={busy}
      title="Busca en Stripe las comisiones que no quedaron registradas al llegar el pago"
      className="inline-flex items-center gap-1.5 text-[11px] text-white/40 hover:text-white transition-colors cursor-pointer disabled:opacity-40">
      {busy ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Traer comisiones de Stripe faltantes
    </button>
  );
}
