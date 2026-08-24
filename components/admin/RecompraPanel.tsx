"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Copy, X, Loader2, ChevronDown, ChevronUp, CalendarClock, MessageCircle, Mail, Send, RefreshCw } from "lucide-react";
import { toast } from "@/lib/toast";
import { TEMP_LABEL, telWhatsapp, type Candidato } from "@/lib/recompra";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/** El correo ya armado por el servidor + el mensaje con el que se armó. */
interface Preview {
  html: string;
  subject: string;
  para: string | null;
  mensaje: string;
}

const TEMP_STYLE: Record<string, string> = {
  tibio: "bg-green-500/15 text-green-300",
  frio: "bg-amber-500/15 text-amber-300",
  dormido: "bg-white/10 text-white/50",
};

/**
 * Clientes que ya compraron y a los que toca ofrecerles lo siguiente.
 *
 * Es la palanca de recurrencia: solo ~9% de los clientes repiten, y cada
 * recompra cuesta mucho menos que un cliente nuevo. La bandeja trae el mensaje
 * ya redactado, pero nada se manda solo — se copia, se manda por WhatsApp o se
 * agenda, siempre con una persona de por medio.
 */
export function RecompraPanel({ candidatos, abiertoInicial = false }: {
  candidatos: Candidato[];
  /** Llega abierta cuando entras desde el atajo de Marketing (`?foco=recompra`). */
  abiertoInicial?: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  /** Resueltos en esta sesión: salen de la lista sin esperar el refresh. */
  const [hechos, setHechos] = useState<Set<string>>(new Set());
  /** Contacto cuyo correo se está previsualizando (uno a la vez). */
  const [mailAbierto, setMailAbierto] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const lista = candidatos.filter((k) => !hechos.has(k.c.id));
  if (lista.length === 0) return null;

  const textoDe = (k: Candidato) => textos[k.c.id] ?? k.mensaje;

  /**
   * Trae el HTML exacto que se mandaría. Se pide al servidor (y no se arma en
   * el navegador) para que la vista previa no pueda diferir del correo real.
   */
  const verCorreo = async (k: Candidato) => {
    if (mailAbierto === k.c.id) { setMailAbierto(null); setPreview(null); return; }
    setMailAbierto(k.c.id);
    setPreview(null);
    try {
      const r = await fetch("/api/admin/recompra/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: k.c.id, mensaje: textoDe(k) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo armar el correo"}`); setMailAbierto(null); return; }
      setPreview({ ...d, mensaje: textoDe(k) });
    } catch {
      toast("⚠️ Error de conexión");
      setMailAbierto(null);
    }
  };

  const enviarCorreo = async (k: Candidato) => {
    setBusy(k.c.id);
    try {
      const r = await fetch("/api/admin/recompra/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: k.c.id, mensaje: textoDe(k) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo enviar"}`); return; }
      toast(d.aviso ? `⚠️ ${d.aviso}` : `✓ Correo enviado a ${(d.destinatarios ?? []).join(", ")}`);
      setMailAbierto(null);
      setPreview(null);
      setHechos((s) => new Set(s).add(k.c.id));
      router.refresh();
    } catch {
      toast("⚠️ Error de conexión");
    } finally {
      setBusy(null);
    }
  };

  const decidir = async (k: Candidato, accion: "contactado" | "omitir") => {
    setBusy(k.c.id);
    try {
      const r = await fetch("/api/admin/recompra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: k.c.id, accion, mensaje: textoDe(k) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo guardar"}`); return; }
      toast(accion === "contactado" ? "✓ Anotado — te lo recuerdo en 3 días" : "Descartado");
      setHechos((s) => new Set(s).add(k.c.id));
      router.refresh();
    } catch {
      toast("⚠️ Error de conexión");
    } finally {
      setBusy(null);
    }
  };

  const copiar = async (k: Candidato) => {
    try {
      await navigator.clipboard.writeText(textoDe(k));
      toast("✓ Texto copiado");
    } catch {
      toast("⚠️ No se pudo copiar");
    }
  };

  const valor = lista.reduce((a, k) => a + k.c.ltv, 0);

  return (
    <div className="mb-4 rounded-2xl border border-green-400/20 bg-green-500/[0.04] overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <Repeat size={16} className="text-green-300 shrink-0" />
        <span className="text-sm font-medium">
          Toca recompra <span className="text-green-300">({lista.length})</span>
        </span>
        <span className="text-white/35 text-xs hidden sm:inline">
          · ya compraron {peso(valor)} entre todos
        </span>
        {abierto ? <ChevronUp size={16} className="ml-auto text-white/30" /> : <ChevronDown size={16} className="ml-auto text-white/30" />}
      </button>

      {abierto && (
        <div className="px-3 pb-3">
          <ul className="flex flex-col gap-2">
            {lista.map((k) => {
              const wa = telWhatsapp(k.c.telefono);
              return (
                <li key={k.c.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-sm font-medium truncate">{k.c.nombre || "(sin nombre)"}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TEMP_STYLE[k.temperatura]}`}>
                      {TEMP_LABEL[k.temperatura]}
                    </span>
                    <span className="text-[11px] text-white/40">
                      compró hace {k.dias} días
                      {k.c.ultimaCompraConcepto && ` · ${k.c.ultimaCompraConcepto}`}
                    </span>
                    {k.c.ltv > 0 && (
                      <span className="text-[11px] text-green-300/80 ml-auto">{peso(k.c.ltv)} de valor</span>
                    )}
                  </div>

                  <textarea
                    value={textoDe(k)}
                    onChange={(e) => setTextos((t) => ({ ...t, [k.c.id]: e.target.value }))}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-sm text-white leading-snug focus:outline-none focus:ring-1 focus:ring-lgb-red resize-none"
                  />

                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}?text=${encodeURIComponent(textoDe(k))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-green-600/80 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    )}
                    {k.c.email && (
                      <button onClick={() => verCorreo(k)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                          mailAbierto === k.c.id
                            ? "bg-lgb-red text-white"
                            : "bg-white/10 hover:bg-white/15 text-white"
                        }`}>
                        <Mail size={13} /> Correo
                      </button>
                    )}
                    <button onClick={() => copiar(k)}
                      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer">
                      <Copy size={13} /> Copiar
                    </button>
                    <button onClick={() => decidir(k, "contactado")} disabled={busy === k.c.id}
                      className="flex items-center gap-1.5 bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
                      {busy === k.c.id ? <Loader2 size={13} className="animate-spin" /> : <CalendarClock size={13} />}
                      Ya le escribí
                    </button>
                    <button onClick={() => decidir(k, "omitir")} disabled={busy === k.c.id}
                      className="flex items-center gap-1 text-white/40 hover:text-white text-xs px-2 py-1.5 cursor-pointer">
                      <X size={12} /> No aplica
                    </button>
                  </div>

                  {mailAbierto === k.c.id && (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/40 overflow-hidden">
                      {!preview ? (
                        <div className="flex items-center gap-2 px-3 py-6 text-xs text-white/40">
                          <Loader2 size={14} className="animate-spin" /> Armando el correo…
                        </div>
                      ) : (
                        <>
                          <div className="px-3 py-2 border-b border-white/8 text-[11px] leading-relaxed">
                            <p className="text-white/40">Para: <span className="text-white/70">{preview.para}</span></p>
                            <p className="text-white/40">Asunto: <span className="text-white/70">{preview.subject}</span></p>
                          </div>
                          {/* El correo real, renderizado. `sandbox` sin allow-scripts:
                              es HTML de nuestra plantilla, pero no hay razón para
                              darle permisos dentro del panel. */}
                          <iframe
                            title="Vista previa del correo"
                            srcDoc={preview.html}
                            sandbox=""
                            className="w-full h-[420px] bg-[#0a0a0a] border-0"
                          />
                          <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-white/8">
                            {preview.mensaje !== textoDe(k) ? (
                              <button onClick={() => verCorreo(k)}
                                className="flex items-center gap-1.5 bg-amber-500/20 text-amber-200 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer">
                                <RefreshCw size={13} /> Cambiaste el texto — actualizar
                              </button>
                            ) : (
                              <button onClick={() => enviarCorreo(k)} disabled={busy === k.c.id}
                                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 cursor-pointer">
                                {busy === k.c.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                Enviar este correo
                              </button>
                            )}
                            <button onClick={() => { setMailAbierto(null); setPreview(null); }}
                              className="text-white/40 hover:text-white text-xs px-2 py-1.5 cursor-pointer">
                              Cerrar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
