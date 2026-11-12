"use client";
import { useState } from "react";
import { MessageSquare, MapPin, Check, Clock } from "lucide-react";
import { formatoMinuto, type ComentarioPrevio } from "@/lib/previo-comentarios";

/**
 * Lo que el cliente ha pedido sobre sus previos, a la vista al abrir el proyecto.
 *
 * Cada renglón es el pedido ORIGINAL tal como lo escribió (la tarea que nació de
 * él se puede editar y renombrar; esto no). El estado sale de esa tarea: en
 * cuanto la palomean pasa a "Atendido", y es lo mismo que ve el cliente.
 */

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const VISIBLES = 4;

export function ComentariosCliente({ comentarios, onVerTareas }: {
  comentarios: ComentarioPrevio[];
  onVerTareas: () => void;
}) {
  const [todos, setTodos] = useState(false);
  if (comentarios.length === 0) return null;

  const pendientes = comentarios.filter((c) => !c.atendido).length;
  const lista = todos ? comentarios : comentarios.slice(0, VISIBLES);

  return (
    <section aria-labelledby="coment-cliente-t" className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={14} className="text-amber-300 shrink-0" aria-hidden />
        <h3 id="coment-cliente-t" className="text-sm font-medium text-white">Comentarios del cliente</h3>
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${pendientes > 0 ? "text-amber-300 border-amber-400/30 bg-amber-400/10" : "text-green-300 border-green-400/25 bg-green-400/10"}`}>
          {pendientes > 0 ? `${pendientes} por atender` : "Todo atendido"}
        </span>
        <button onClick={onVerTareas} className="ml-auto text-[11px] text-white/45 hover:text-white underline underline-offset-2 cursor-pointer">
          Ver tareas
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {lista.map((c) => (
          <li key={c.id} className="rounded-lg bg-black/20 border border-white/8 px-3 py-2.5">
            <p className="text-sm text-white/85 whitespace-pre-line break-words">{c.texto}</p>
            <div className="flex items-center gap-x-3 gap-y-1 mt-1.5 flex-wrap text-[11px] text-white/40">
              <span>{[c.tema, c.previoNum && c.previoNum > 1 ? `Previo ${c.previoNum}` : "Previo"].filter(Boolean).join(" · ")}</span>
              {c.segundo !== null && (
                <span className="inline-flex items-center gap-1"><MapPin size={10} aria-hidden /> minuto {formatoMinuto(c.segundo)}</span>
              )}
              <span>{fecha(c.creadoAt)}</span>
              {c.atendido ? (
                <span className="ml-auto inline-flex items-center gap-1 text-green-300"><Check size={11} aria-hidden /> Atendido</span>
              ) : (
                <span className="ml-auto inline-flex items-center gap-1 text-amber-300"><Clock size={11} aria-hidden /> Por atender</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {comentarios.length > VISIBLES && (
        <button onClick={() => setTodos((v) => !v)} className="mt-2 text-[11px] text-white/45 hover:text-white cursor-pointer">
          {todos ? "Ver menos" : `Ver los ${comentarios.length} comentarios`}
        </button>
      )}
    </section>
  );
}
