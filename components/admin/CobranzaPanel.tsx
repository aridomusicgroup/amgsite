"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Eye, Loader2, ChevronDown, Check, Ban, X, MailX } from "lucide-react";
import { toast } from "@/lib/toast";

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

type Deudor = {
  ventaId: string; folio: string; concepto: string; fecha: string;
  total: number; cobrado: number; saldo: number; diasVenta: number;
  contactoId: string | null; nombre: string | null; email: string | null;
  noContactar: boolean; orderId: string | null;
  enviados: { toque: number; fecha: string }[];
  siguiente: 1 | 2 | 3 | null; listo: boolean; faltanDias: number; bloqueo: string | null;
};

const TOQUE_LABEL: Record<number, string> = { 1: "Recordatorio", 2: "Acomodo", 3: "Cierre" };
const TOQUE_QUE_HACE: Record<number, string> = {
  1: "Da por hecho que se le pasó. Aquí paga la mayoría.",
  2: "Le ofrece partirlo o moverlo — convierte al que no puede pagar y por eso te evita.",
  3: "No pide dinero: cierra, promete no volver a escribir, y prende «no contactar».",
};

/**
 * La cola de cobranza: borradores para aprobar, uno por uno.
 *
 * Nada sale solo, y eso es una decisión, no una limitación. Un cobro
 * automático mal cronometrado a un cliente recurrente cuesta la relación, y
 * **6 de los 10 que deben hoy son recurrentes**. Es la misma disciplina de la
 * bandeja de recompra y de los seguimientos del chatbot: ningún cliente recibe
 * algo que una persona no vio antes.
 *
 * Los tres toques no son tres versiones de "págame" — cada uno tiene un trabajo
 * distinto, y el panel lo dice en voz alta para que quien manda el 2 no le
 * cambie el tono al del 1.
 */
export function CobranzaPanel() {
  const router = useRouter();
  const [lista, setLista] = useState<Deudor[] | null>(null);
  const [abierto, setAbierto] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [previa, setPrevia] = useState<{ d: Deudor; toque: number; subject: string; html: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/cobranza", { cache: "no-store" });
      setLista(r.ok ? ((await r.json()).deudores ?? []) : []);
    } catch { setLista([]); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const verCorreo = async (d: Deudor, toque: number) => {
    setBusy(`${d.ventaId}-ver`);
    try {
      const r = await fetch("/api/admin/cobranza", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ventaId: d.ventaId, toque }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${j.error || "No se pudo armar la previa"}`); return; }
      setPrevia({ d, toque, subject: j.subject, html: j.html });
    } finally { setBusy(null); }
  };

  const mandar = async (d: Deudor, toque: number) => {
    const q = toque === 3
      ? `Éste es el correo de CIERRE de ${d.folio}.\n\nLe promete que es el último correo, y al mandarlo ${d.nombre || "el cliente"} queda marcado como «no contactar»: no le va a volver a escribir el sistema.\n\n¿Mandarlo?`
      : `¿Mandarle a ${d.nombre || d.email} el toque ${toque} (${TOQUE_LABEL[toque]}) por ${peso(d.saldo)} de ${d.folio}?`;
    if (!confirm(q)) return;
    setBusy(d.ventaId);
    try {
      const r = await fetch("/api/admin/cobranza", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ventaId: d.ventaId, toque }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${j.error || "No se pudo mandar"}`); return; }
      toast(j.cerrado ? `✓ Cerrado y marcado — se le mandó a ${j.email}` : `✓ Se le mandó a ${j.email}`);
      setPrevia(null);
      await cargar();
      router.refresh();
    } finally { setBusy(null); }
  };

  const marcar = async (d: Deudor) => {
    if (!d.contactoId) return;
    const prender = !d.noContactar;
    const motivo = prender ? prompt("¿Por qué ya no le escribimos? (ej. «nos bloqueó», «pidió que no le escribamos»)") : null;
    if (prender && motivo === null) return;
    setBusy(`${d.ventaId}-marca`);
    try {
      const r = await fetch("/api/admin/cobranza", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactoId: d.contactoId, noContactar: prender, motivo }),
      });
      if (!r.ok) { toast("⚠️ No se pudo"); return; }
      toast(prender ? "✓ No se le vuelve a escribir" : "✓ Se le puede volver a escribir");
      await cargar();
      router.refresh();
    } finally { setBusy(null); }
  };

  if (lista === null || lista.length === 0) return null;

  const listos = lista.filter((d) => d.listo);
  const agotados = lista.filter((d) => d.siguiente === null);

  return (
    <div className="mb-5 rounded-2xl border border-white/10 bg-lgb-surface overflow-hidden">
      <button onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors cursor-pointer">
        <Send size={15} className="text-lgb-red shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/85">
            Cobranza: {listos.length > 0
              ? <b className="text-lgb-red">{listos.length} listo{listos.length === 1 ? "" : "s"} para escribir</b>
              : <span className="text-white/50">nada que mandar hoy</span>}
          </p>
          <p className="text-[11px] text-white/40 mt-0.5">
            {lista.length} saldo{lista.length === 1 ? "" : "s"} en la cola
            {agotados.length > 0 && <> · {agotados.length} ya con los tres toques</>}
          </p>
        </div>
        <ChevronDown size={16} className={`text-white/30 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-2">
          {lista.map((d) => {
            const t = d.siguiente;
            return (
              <div key={d.ventaId} className={`rounded-xl border px-3 py-2.5 ${d.listo ? "border-lgb-red/30 bg-lgb-red/[0.05]" : "border-white/8 bg-white/[0.02]"}`}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/85 truncate">
                      {d.nombre || d.email || "Sin nombre"}
                      <span className="text-white/35"> · {d.folio} — {peso(d.saldo)}</span>
                    </p>
                    <p className="text-[11px] text-white/35 truncate">
                      {d.concepto} · hace {d.diasVenta} d
                      {d.enviados.length > 0 && <> · ya van {d.enviados.length} de 3</>}
                      {d.noContactar && <span className="text-red-300"> · no contactar</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {d.contactoId && (
                      <button onClick={() => marcar(d)} disabled={busy === `${d.ventaId}-marca`}
                        title={d.noContactar ? "Volver a permitirle correos" : "Ya no escribirle (nos bloqueó, o lo pidió)"}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${d.noContactar ? "bg-red-500/20 text-red-300" : "bg-white/5 text-white/30 hover:text-white/70"}`}>
                        <Ban size={12} />
                      </button>
                    )}
                    {t !== null && !d.bloqueo && (
                      <>
                        <button onClick={() => verCorreo(d, t)} disabled={busy !== null}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/8 text-white/60 hover:bg-white/15 disabled:opacity-40 cursor-pointer">
                          {busy === `${d.ventaId}-ver` ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />} Ver
                        </button>
                        <button onClick={() => mandar(d, t)} disabled={busy !== null || !d.listo}
                          title={d.listo ? `Mandar el toque ${t}` : `Faltan ${d.faltanDias} días para el toque ${t}`}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-lgb-red text-white hover:bg-red-700 disabled:opacity-30 cursor-pointer">
                          {busy === d.ventaId ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                          Toque {t}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Por qué no se puede, o qué hace el toque que sigue. Va debajo
                    para que nadie mande el 2 con el tono del 1. */}
                {d.bloqueo ? (
                  <p className="text-[11px] text-amber-200/70 mt-1.5 flex items-center gap-1.5">
                    <MailX size={11} /> {d.bloqueo}
                  </p>
                ) : t === null ? (
                  <p className="text-[11px] text-white/30 mt-1.5">
                    Ya se le mandaron los tres. Lo que sigue es una llamada, no otro correo.
                  </p>
                ) : (
                  <p className="text-[11px] text-white/30 mt-1.5">
                    <b className="text-white/50">Toque {t} · {TOQUE_LABEL[t]}:</b> {TOQUE_QUE_HACE[t]}
                    {!d.listo && <span className="text-white/25"> — faltan {d.faltanDias} d</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {previa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setPrevia(null)}>
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-lgb-dark border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4 pb-3">
              <div className="min-w-0">
                <p className="font-coolvetica text-base truncate">
                  Toque {previa.toque} · {TOQUE_LABEL[previa.toque]} → {previa.d.nombre || previa.d.email}
                </p>
                <p className="text-white/40 text-xs mt-0.5 truncate">Asunto: {previa.subject}</p>
              </div>
              <button onClick={() => setPrevia(null)} className="text-white/40 hover:text-white cursor-pointer shrink-0"><X size={18} /></button>
            </div>
            {/* En un iframe aislado: es HTML de correo con sus propios estilos,
                y suelto se pelearía con los del panel. */}
            <iframe title="Previa del correo" sandbox="" srcDoc={previa.html}
              className="flex-1 min-h-[22rem] w-full bg-black rounded-xl border border-white/8 mx-4" />
            <div className="flex items-center gap-2 p-4">
              <button onClick={() => mandar(previa.d, previa.toque)} disabled={busy !== null || !previa.d.listo}
                className="flex items-center gap-1.5 bg-lgb-red text-white px-3.5 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-40 cursor-pointer">
                {busy === previa.d.ventaId ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Mandárselo
              </button>
              <button onClick={() => setPrevia(null)} className="text-white/50 hover:text-white text-sm px-2 cursor-pointer">Cerrar</button>
              <p className="text-[11px] text-white/25 ml-auto text-right">
                El botón de pago se genera al mandarlo.<br />En la previa va vacío.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
