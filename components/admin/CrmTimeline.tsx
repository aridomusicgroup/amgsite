"use client";
import { useEffect, useState } from "react";
import { MessageSquare, FileText, FileSignature, Receipt, ClipboardList, StickyNote, Repeat, Loader2, Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import type { EventoCrm } from "@/app/api/admin/crm-timeline/route";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;
const fecha = (s: string) =>
  s ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

/** Ícono y color por familia de evento: se lee de un vistazo qué pasó. */
const ESTILO: Record<EventoCrm["clase"], { icon: typeof MessageSquare; cls: string }> = {
  mensaje:    { icon: MessageSquare,  cls: "text-blue-300 bg-blue-500/10 border-blue-400/25" },
  cotizacion: { icon: FileText,       cls: "text-amber-300 bg-amber-500/10 border-amber-400/25" },
  contrato:   { icon: FileSignature,  cls: "text-purple-300 bg-purple-500/10 border-purple-400/25" },
  venta:      { icon: Receipt,        cls: "text-green-300 bg-green-500/10 border-green-400/25" },
  proyecto:   { icon: ClipboardList,  cls: "text-lgb-red bg-lgb-red/10 border-lgb-red/25" },
  nota:       { icon: StickyNote,     cls: "text-white/60 bg-white/5 border-white/15" },
  recompra:   { icon: Repeat,         cls: "text-green-300 bg-green-500/10 border-green-400/25" },
};

/**
 * Historial completo de un contacto en un solo hilo: conversaciones del bot,
 * cotizaciones, contratos, ventas, producciones y notas del equipo.
 * Se carga al abrir la ficha (no se precargan los 254 contactos).
 */
export function CrmTimeline({ contactoId }: { contactoId: string }) {
  const [eventos, setEventos] = useState<EventoCrm[] | null>(null);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const r = await fetch(`/api/admin/crm-timeline?contacto_id=${contactoId}`, { cache: "no-store" });
      const d = await r.json();
      setEventos(Array.isArray(d.eventos) ? d.eventos : []);
    } catch {
      setEventos([]);
    }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [contactoId]);

  const agregarNota = async () => {
    const texto = nota.trim();
    if (!texto) return;
    setGuardando(true);
    try {
      const r = await fetch("/api/admin/crm-timeline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacto_id: contactoId, texto }),
      });
      if (!r.ok) throw new Error();
      setNota("");
      toast("✓ Nota guardada");
      cargar();
    } catch {
      toast("⚠️ No se pudo guardar la nota");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-white/8">
      <p className="text-[11px] text-white/40 uppercase tracking-wider mb-2.5">Historial</p>

      {/* Nota rápida: "le llamé", "quedó de avisar el lunes"… */}
      <div className="flex gap-1.5 mb-3">
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarNota(); } }}
          placeholder="Anota algo: le llamé, quedó de avisar…"
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-lgb-red"
        />
        <button
          onClick={agregarNota}
          disabled={guardando || !nota.trim()}
          className="flex items-center gap-1 bg-white/10 hover:bg-white/15 text-white px-2.5 rounded-lg text-xs disabled:opacity-40 cursor-pointer"
        >
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        </button>
      </div>

      {eventos === null ? (
        <p className="text-white/30 text-xs flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Cargando…</p>
      ) : eventos.length === 0 ? (
        <p className="text-white/30 text-xs">Sin historial todavía. Las conversaciones del bot aparecen aquí en cuanto escriban.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {eventos.map((e) => {
            const st = ESTILO[e.clase] ?? ESTILO.nota;
            const Icon = st.icon;
            return (
              <li key={e.id} className="flex items-start gap-2.5">
                <span className={`mt-0.5 w-6 h-6 rounded-lg border grid place-items-center shrink-0 ${st.cls}`}>
                  <Icon size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/85 break-words">{e.titulo}</p>
                  {e.detalle && <p className="text-[11px] text-white/40 break-words">{e.detalle}</p>}
                </div>
                <div className="text-right shrink-0">
                  {typeof e.monto === "number" && e.monto > 0 && (
                    <p className="text-[11px] text-green-300 tabular-nums">{peso(e.monto)}</p>
                  )}
                  <p className="text-[10px] text-white/30 tabular-nums">{fecha(e.fecha)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
