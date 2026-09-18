"use client";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { captureAttribution, getAttribution } from "@/lib/attribution";

/** Botón de compra: abre el checkout de Stripe del curso (el precio lo pone el servidor). */
export function BotonComprar({ cursoId, precio, preventa = false, className = "" }: { cursoId: string; precio: number; preventa?: boolean; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Guarda de dónde llegó (Reel, bio, anuncio) para que la venta quede atribuida.
  useEffect(() => { captureAttribution(); }, []);

  const comprar = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/checkout-curso", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curso_id: cursoId, modo: "curso", attrib: getAttribution() }),
      });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || "No se pudo abrir el pago.");
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo abrir el pago.");
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <button onClick={comprar} disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 bg-lgb-red text-white px-6 py-4 rounded-full text-base font-medium hover:bg-red-700 transition-colors disabled:opacity-60 cursor-pointer">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />}
        {preventa ? "Apartar mi lugar" : "Inscribirme"} · ${precio.toLocaleString("es-MX")} MXN
      </button>
      <p className="text-[11px] text-white/50 text-center mt-2">
        {preventa ? "Pago seguro con tarjeta (Stripe). Te llega la confirmación por correo." : "Pago seguro con tarjeta (Stripe). Acceso inmediato en tu cuenta."}
      </p>
      {err && <p className="text-xs text-red-400 text-center mt-2">{err}</p>}
    </div>
  );
}
