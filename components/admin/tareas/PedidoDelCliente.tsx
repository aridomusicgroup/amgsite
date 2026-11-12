"use client";
import { useEffect, useState } from "react";
import { MessageSquare, MapPin, Check } from "lucide-react";
import { formatoMinuto, type ComentarioPrevio } from "@/lib/previo-comentarios";

/**
 * El pedido ORIGINAL del cliente, arriba en la ventana de la tarea que nació de
 * su comentario. Las notas de la tarea llevan lo mismo, pero se pueden editar;
 * esto es lo que de verdad escribió, con el previo y el minuto.
 *
 * Se consulta SIEMPRE, sin fiarse de las notas: si alguien las reescribe, el
 * pedido original tiene que seguir ahí. Es una consulta mínima por índice.
 */

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function PedidoDelCliente({ tareaId }: { tareaId: string }) {
  const [lista, setLista] = useState<ComentarioPrevio[]>([]);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/previo-comentarios?tarea_id=${encodeURIComponent(tareaId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { comentarios: [] }))
      .then((d) => { if (vivo) setLista((d.comentarios ?? []) as ComentarioPrevio[]); })
      .catch(() => { /* sin histórico: las notas de la tarea ya traen el pedido */ });
    return () => { vivo = false; };
  }, [tareaId]);

  if (lista.length === 0) return null;

  return (
    <section aria-label="Pedido del cliente" className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3.5">
      <div className="flex items-center gap-2 mb-2 text-xs text-amber-200/90">
        <MessageSquare size={13} aria-hidden /> Lo que pidió el cliente
      </div>
      <ul className="flex flex-col gap-2.5">
        {lista.map((c) => (
          <li key={c.id}>
            <p className="text-sm text-white/90 whitespace-pre-line break-words">{c.texto}</p>
            <div className="flex items-center gap-x-3 gap-y-1 mt-1 flex-wrap text-[11px] text-white/40">
              <span>{[c.tema, c.previoNum && c.previoNum > 1 ? `Previo ${c.previoNum}` : "Previo"].filter(Boolean).join(" · ")}</span>
              {c.segundo !== null && (
                <span className="inline-flex items-center gap-1"><MapPin size={10} aria-hidden /> minuto {formatoMinuto(c.segundo)}</span>
              )}
              <span>{fecha(c.creadoAt)}</span>
              {c.atendido && <span className="inline-flex items-center gap-1 text-green-300"><Check size={11} aria-hidden /> Atendido</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
