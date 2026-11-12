"use client";
import { useId, useState } from "react";
import { MapPin, Send, Loader2, Check, Clock, X } from "lucide-react";
import { formatoMinuto, MAX_COMENTARIO, type ComentarioDelCliente } from "@/lib/previo-comentarios";

/**
 * Lo que el cliente le dice al estudio sobre un previo.
 *
 * Cada comentario llega al equipo como una tarea (el servidor la crea), y aquí
 * queda a la vista con su estado: "En manos del estudio" hasta que la palomean,
 * "Atendido" después. El cliente nunca ve las tareas internas, sólo lo suyo.
 *
 * `puedeComentar` es sólo el previo vigente de cada tema: comentar uno viejo
 * confunde (ya se hicieron cambios encima). Los viejos muestran su histórico y
 * nada más.
 *
 * `leerSegundo` pregunta al reproductor del previo en qué minuto va, para el
 * botón "Marcar minuto": decir "en el 1:23 se oye feo" ahorra media hora de
 * ida y vuelta por WhatsApp.
 */

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ComentariosPrevio({ pedidoId, jobId, comentarios, puedeComentar, leerSegundo }: {
  pedidoId: string;
  jobId: string;
  /** Los que ya había al cargar la página, de este previo. */
  comentarios: ComentarioDelCliente[];
  puedeComentar: boolean;
  leerSegundo: () => number | null;
}) {
  const idCampo = useId();
  const [texto, setTexto] = useState("");
  const [segundo, setSegundo] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recien, setRecien] = useState<ComentarioDelCliente[]>([]);

  // Los que se acaban de mandar se ven al instante; si la página se recarga ya
  // vienen en `comentarios`, y no deben salir dos veces.
  const vistos = new Set(comentarios.map((c) => c.id));
  const lista = [...comentarios, ...recien.filter((c) => !vistos.has(c.id))]
    .sort((a, b) => a.creadoAt.localeCompare(b.creadoAt));

  if (!puedeComentar && lista.length === 0) return null;

  const marcarMinuto = () => {
    const s = leerSegundo();
    if (s === null) { setError("Dale play al previo y marca el minuto donde lo quieres comentar."); return; }
    setError(null);
    setSegundo(s);
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch(`/api/cuenta/pedido/${pedidoId}/comentarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, texto: t, segundo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No pudimos enviar tu comentario.");
      setRecien((x) => [...x, d.comentario as ComentarioDelCliente]);
      setTexto("");
      setSegundo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos enviar tu comentario.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      {lista.length > 0 && (
        <ul className="flex flex-col gap-2 mb-3" aria-label="Tus comentarios sobre este previo">
          {lista.map((c) => (
            <li key={c.id} className="rounded-xl bg-white/[0.04] border border-white/8 px-3 py-2.5">
              <p className="text-sm text-white/80 whitespace-pre-line break-words">{c.texto}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-[11px] text-white/35">{fecha(c.creadoAt)}</span>
                {c.segundo !== null && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                    <MapPin size={10} aria-hidden /> minuto {formatoMinuto(c.segundo)}
                  </span>
                )}
                {c.atendido ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-green-300">
                    <Check size={11} aria-hidden /> Atendido
                  </span>
                ) : (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-amber-300">
                    <Clock size={11} aria-hidden /> En manos del estudio
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {puedeComentar && (
        <div>
          <label htmlFor={idCampo} className="block text-xs text-white/50 mb-1.5">
            ¿Qué le cambiamos a este previo?
          </label>
          <textarea
            id={idCampo}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={MAX_COMENTARIO}
            rows={3}
            placeholder="Ej. Sube la voz en el coro y baja un poco el bajo"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-lgb-red/60 resize-y min-h-[76px]"
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {segundo === null ? (
              <button
                type="button"
                onClick={marcarMinuto}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <MapPin size={13} aria-hidden /> Marcar el minuto donde voy
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-xl text-xs text-white bg-lgb-red/15 border border-lgb-red/30">
                <MapPin size={13} aria-hidden /> Minuto {formatoMinuto(segundo)}
                <button
                  type="button"
                  onClick={() => setSegundo(null)}
                  aria-label="Quitar el minuto"
                  className="p-1.5 rounded-lg text-white/60 hover:text-white cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || !texto.trim()}
              className="ml-auto inline-flex items-center gap-2 bg-lgb-red text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {enviando ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />}
              Enviar al estudio
            </button>
          </div>
          <p role="status" aria-live="polite" className={`text-xs mt-2 ${error ? "text-red-300" : "text-white/35"}`}>
            {error ?? (recien.length > 0 ? "✓ Listo, ya lo recibió el estudio. Lo ves arriba." : "Le llega directo al equipo como una tarea de cambios.")}
          </p>
        </div>
      )}
    </div>
  );
}
