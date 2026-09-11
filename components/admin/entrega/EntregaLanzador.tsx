"use client";
import { useCallback, useEffect, useState } from "react";
import { EntregaModal } from "./EntregaModal";
import { EVENTO_ENTREGA, type PedidoEntrega } from "@/lib/entrega-cliente";

/**
 * El único lugar donde vive el cuadro de entrega. Va montado una vez en el
 * menú del panel, así que funciona desde cualquier página.
 *
 * Se abre por dos caminos:
 *   · el evento `arido:entrega`, que lanzan las palomitas cuando el servidor
 *     dice que ya sólo falta subir a Drive, y la píldora "Preparar entrega";
 *   · `?entregar=proyecto[:tema]` en la URL, que es a donde lleva el push
 *     "Lista para entregar" que les llega a los admins.
 */
export function EntregaLanzador() {
  const [pedido, setPedido] = useState<PedidoEntrega | null>(null);

  useEffect(() => {
    const alPedir = (e: Event) => setPedido((e as CustomEvent<PedidoEntrega>).detail);
    window.addEventListener(EVENTO_ENTREGA, alPedir);

    // Se lee de window y no con useSearchParams: el menú está en todas las
    // páginas del panel, y ese hook obligaría a envolverlas en Suspense.
    const url = new URL(window.location.href);
    const q = url.searchParams.get("entregar");
    if (q) {
      const [proyectoId, tareaId] = q.split(":");
      if (proyectoId) setPedido({ proyectoId, tareaId: tareaId || null });
      // Se quita de la URL: recargar la página no debe reabrir el cuadro.
      url.searchParams.delete("entregar");
      window.history.replaceState(null, "", url);
    }
    return () => window.removeEventListener(EVENTO_ENTREGA, alPedir);
  }, []);

  const cerrar = useCallback(() => setPedido(null), []);
  if (!pedido) return null;
  return (
    <EntregaModal
      key={`${pedido.proyectoId}:${pedido.tareaId ?? ""}`}
      proyectoId={pedido.proyectoId}
      tareaId={pedido.tareaId}
      onCerrar={cerrar}
    />
  );
}
