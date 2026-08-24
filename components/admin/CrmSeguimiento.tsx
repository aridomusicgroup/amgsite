"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import { toast } from "@/lib/toast";

const hoyISO = () => new Date().toISOString().slice(0, 10);
const enDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const fechaCorta = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

/** Acciones típicas del negocio: un clic en vez de escribirlas cada vez. */
const SUGERENCIAS = ["Llamar", "Mandar cotización", "Mandar beats", "Confirmar anticipo", "Preguntar si sigue interesado"];

/**
 * Próxima acción de un contacto: qué toca y cuándo. Es lo que convierte la
 * lista de contactos en una lista de trabajo — y lo que alimenta el
 * recordatorio diario.
 */
export function CrmSeguimiento({ contactoId, accion, fecha }: {
  contactoId: string;
  accion: string | null;
  fecha: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [txt, setTxt] = useState(accion ?? "");
  const [fch, setFch] = useState(fecha ?? enDias(2));
  const [busy, setBusy] = useState(false);

  const guardar = async (limpiar = false) => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/crm-seguimiento", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: contactoId,
          proxima_accion: limpiar ? null : txt.trim() || null,
          proxima_fecha: limpiar ? null : (txt.trim() ? fch : null),
        }),
      });
      if (!r.ok) throw new Error();
      toast(limpiar ? "✓ Seguimiento cerrado" : "✓ Seguimiento programado");
      setAbierto(false);
      router.refresh();
    } catch {
      toast("⚠️ No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  const vencida = !!fecha && fecha < hoyISO();
  const esHoy = fecha === hoyISO();

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className={`mt-1.5 inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
          vencida ? "bg-red-500/10 border-red-400/30 text-red-300"
            : esHoy ? "bg-amber-500/10 border-amber-400/30 text-amber-300"
            : accion ? "bg-white/5 border-white/12 text-white/60 hover:text-white"
            : "bg-transparent border-white/10 text-white/35 hover:text-white/70"
        }`}
      >
        <CalendarClock size={11} />
        {accion
          ? <>{accion}{fecha && <span className="opacity-70"> · {vencida ? "venció " : ""}{fechaCorta(fecha)}</span>}</>
          : "Programar seguimiento"}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SUGERENCIAS.map((s) => (
          <button key={s} onClick={() => setTxt(s)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
              txt === s ? "bg-lgb-red text-white border-lgb-red" : "bg-white/5 border-white/10 text-white/55 hover:text-white"
            }`}>
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <input
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); guardar(); } }}
          placeholder="¿Qué sigue con este contacto?"
          autoFocus
          className="flex-1 min-w-[160px] bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-lgb-red"
        />
        <input
          type="date" value={fch} onChange={(e) => setFch(e.target.value)}
          className="min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-lgb-red"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {[["Hoy", hoyISO()], ["Mañana", enDias(1)], ["En 3 días", enDias(3)], ["En 1 semana", enDias(7)]].map(([lbl, v]) => (
          <button key={lbl} onClick={() => setFch(v)}
            className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer ${
              fch === v ? "bg-white/15 border-white/25 text-white" : "bg-white/5 border-white/10 text-white/45 hover:text-white"
            }`}>
            {lbl}
          </button>
        ))}
        <button onClick={() => guardar()} disabled={busy || !txt.trim()}
          className="ml-auto flex items-center gap-1 bg-lgb-red text-white px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50 cursor-pointer">
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar
        </button>
        {accion && (
          <button onClick={() => guardar(true)} disabled={busy}
            className="text-white/40 hover:text-white text-xs px-1.5 cursor-pointer" title="Ya lo atendí">
            Listo
          </button>
        )}
        <button onClick={() => setAbierto(false)} className="text-white/30 hover:text-white p-1 cursor-pointer"><X size={13} /></button>
      </div>
    </div>
  );
}
