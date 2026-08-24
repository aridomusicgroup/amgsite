"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";

type Resultado =
  | { estado: "sin_pedido" }
  | { estado: "coincide" }
  | { estado: "distinto"; orderId: string; correoPedido: string; proyecto: string }
  | { estado: "ambiguo"; correosDistintos: string[] };

/**
 * Si este contacto tiene un pedido con producción (proyecto ligado a
 * `orders`) cuyo correo NO coincide con el de la ficha, lo avisa aquí mismo
 * — es donde el staff ya está mirando cuando corrige un dato mal capturado.
 * No avisa nada para clientes que solo compran en BeatStars: esos nunca
 * tienen fila en `orders`, así que no hay panel de progreso que revisar.
 * Ver lib/cliente-correo.ts para el porqué del diseño (no auto-sincroniza).
 */
export function AvisoCorreoPedido({ contactoId, email }: { contactoId: string; email: string }) {
  const [r, setR] = useState<Resultado | null>(null);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/contactos/${contactoId}/correo-pedido?email=${encodeURIComponent(email)}`)
      .then((res) => (res.ok ? res.json() : { estado: "sin_pedido" }))
      .then((d) => { if (vivo) setR(d); })
      .catch(() => { if (vivo) setR({ estado: "sin_pedido" }); });
    return () => { vivo = false; };
  }, [contactoId, email]);

  if (!r || r.estado === "sin_pedido" || r.estado === "coincide") return null;

  if (r.estado === "ambiguo") {
    return (
      <div className="col-span-2 sm:col-span-3 mt-1 flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
        <AlertTriangle size={13} className="text-amber-300 shrink-0 mt-0.5" />
        <span className="text-amber-200/90">
          Tiene pedidos con correos distintos entre sí ({r.correosDistintos.join(", ")}) — revísalo a mano en Pedidos, no hay uno solo que corregir.
        </span>
      </div>
    );
  }

  const info = r; // const aparte: cierra el tipo angosto "distinto" para el callback de abajo

  const aplicar = async () => {
    setAplicando(true);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: info.orderId, customer_email: email }),
      });
      const d = await res.json();
      if (!res.ok) { toast(d.error || "No se pudo corregir."); return; }
      setR({ estado: "coincide" });
      toast("✓ Correo del pedido corregido");
    } catch { toast("Error de conexión."); }
    finally { setAplicando(false); }
  };

  return (
    <div className="col-span-2 sm:col-span-3 mt-1 flex flex-wrap items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
      <AlertTriangle size={13} className="text-amber-300 shrink-0" />
      <span className="text-amber-200/90">
        Su pedido <b>{info.proyecto}</b> usa un correo distinto: <b>{info.correoPedido}</b>
      </span>
      <button
        onClick={aplicar}
        disabled={aplicando}
        className="ml-auto flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-2.5 py-1 rounded-lg font-medium disabled:opacity-50 shrink-0"
      >
        {aplicando ? <Loader2 size={12} className="animate-spin" /> : null}
        Usar {email} en su pedido
      </button>
    </div>
  );
}
