"use client";
import { useEffect, useState } from "react";
import { Sparkles, Send, Copy, Check, X, Loader2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Seguimiento } from "@/app/api/admin/followups/route";

const CANAL_LABEL: Record<string, string> = { instagram: "Instagram", messenger: "Facebook", whatsapp: "WhatsApp" };
const TOQUE_LABEL: Record<number, string> = { 1: "1er recordatorio", 2: "2º recordatorio", 3: "último intento" };

/**
 * Bandeja de seguimientos que redactó la IA del chatbot para reactivar leads
 * que escribieron y no cerraron.
 *
 * REGLA: nada sale solo. Cada mensaje se revisa, se puede editar y se envía de
 * uno en uno — no hay "enviar todos" a propósito: del otro lado hay personas.
 */
export function SeguimientosSugeridos() {
  const [lista, setLista] = useState<Seguimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  /** Seguimientos donde Meta bloqueó el envío automático → mandar a mano. */
  const [manual, setManual] = useState<Record<string, string>>({});

  const cargar = async () => {
    try {
      const r = await fetch("/api/admin/followups", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "No se pudieron cargar."); setLista([]); return; }
      // La API ya pide solo los pendientes; aquí no se vuelve a filtrar.
      setLista(d.seguimientos ?? []);
      setError(null);
    } catch {
      setError("No se pudo contactar al chatbot.");
      setLista([]);
    }
  };

  useEffect(() => { cargar(); }, []);

  const textoDe = (f: Seguimiento) => textos[f._id] ?? f.edited ?? f.draft ?? "";

  const enviar = async (f: Seguimiento, accion: "enviar" | "manual") => {
    setBusy(f._id);
    try {
      const r = await fetch("/api/admin/followups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: f._id, accion, edited: textoDe(f) }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.manual) {
          setManual((m) => ({ ...m, [f._id]: d.error }));
          toast("⚠️ Instagram no deja mandarlo solo — cópialo y mándalo tú");
        } else {
          toast(`⚠️ ${d.error || "No se pudo enviar"}`);
        }
        return;
      }
      toast(accion === "manual" ? "✓ Marcado como enviado" : "✓ Mensaje enviado");
      setLista((l) => (l ?? []).filter((x) => x._id !== f._id));
    } finally {
      setBusy(null);
    }
  };

  const omitir = async (f: Seguimiento) => {
    setBusy(f._id);
    try {
      await fetch("/api/admin/followups", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: f._id, status: "omitido" }),
      });
      toast("Seguimiento omitido");
      setLista((l) => (l ?? []).filter((x) => x._id !== f._id));
    } finally {
      setBusy(null);
    }
  };

  const copiar = async (f: Seguimiento) => {
    try {
      await navigator.clipboard.writeText(textoDe(f));
      toast("✓ Texto copiado");
    } catch {
      toast("⚠️ No se pudo copiar");
    }
  };

  // Sin datos o sin nada pendiente: no ocupa espacio en la pantalla.
  if (lista === null || (lista.length === 0 && !error)) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <Sparkles size={16} className="text-amber-300 shrink-0" />
        <span className="text-sm font-medium">
          Seguimientos sugeridos
          {lista.length > 0 && <span className="text-amber-300"> ({lista.length})</span>}
        </span>
        <span className="text-white/35 text-xs hidden sm:inline">· redactados por la IA, tú los apruebas</span>
        {abierto ? <ChevronUp size={16} className="ml-auto text-white/30" /> : <ChevronDown size={16} className="ml-auto text-white/30" />}
      </button>

      {abierto && (
        <div className="px-3 pb-3">
          {error && <p className="text-red-300 text-xs px-1 pb-2">{error}</p>}

          <ul className="flex flex-col gap-2">
            {lista.map((f) => {
              const nombre = f.conversation?.name || f.conversation?.username || f.userId;
              const bloqueado = manual[f._id];
              const abierto2 = expandido === f._id;
              return (
                <li key={f._id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-sm font-medium truncate">{nombre}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/45">
                      {CANAL_LABEL[f.channel] ?? f.channel}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">
                      {TOQUE_LABEL[f.touch] ?? `toque ${f.touch}`}
                    </span>
                    {f.conversation?.interest && (
                      <span className="text-[10px] text-white/40">· {f.conversation.interest}</span>
                    )}
                  </div>

                  <textarea
                    value={textoDe(f)}
                    onChange={(e) => setTextos((t) => ({ ...t, [f._id]: e.target.value }))}
                    onFocus={() => setExpandido(f._id)}
                    rows={abierto2 ? 4 : 2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white leading-snug focus:outline-none focus:ring-1 focus:ring-lgb-red resize-none"
                  />

                  {bloqueado && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-400/25 px-2.5 py-2">
                      <AlertTriangle size={13} className="text-amber-300 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-200/90 leading-snug">{bloqueado}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {!bloqueado ? (
                      <button
                        onClick={() => enviar(f, "enviar")}
                        disabled={busy === f._id || !textoDe(f).trim()}
                        className="flex items-center gap-1.5 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                      >
                        {busy === f._id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Enviar
                      </button>
                    ) : (
                      <>
                        <button onClick={() => copiar(f)}
                          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer">
                          <Copy size={13} /> Copiar texto
                        </button>
                        <button onClick={() => enviar(f, "manual")} disabled={busy === f._id}
                          className="flex items-center gap-1.5 bg-green-600/80 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer">
                          {busy === f._id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Ya lo mandé
                        </button>
                      </>
                    )}
                    <button onClick={() => omitir(f)} disabled={busy === f._id}
                      className="flex items-center gap-1 text-white/40 hover:text-white text-xs px-2 py-1.5 cursor-pointer">
                      <X size={12} /> Omitir
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
