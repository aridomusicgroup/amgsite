"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Send, Check, MailX } from "lucide-react";
import { toast } from "@/lib/toast";
import type { RenderJobResumen } from "@/lib/erp-data";
import type { MusicoLite } from "@/lib/render-jobs";

type DeVenta = { id: string; nombre: string; instrumento: string; tienePortal: boolean; tieneCorreo: boolean };

const inp = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-lgb-red/60";
const lbl = "block text-[10px] uppercase tracking-wider text-white/30 mb-1";

const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

/**
 * Mandarle a otro músico un previo que ya está hecho.
 *
 * No renderiza nada: reusa el MISMO archivo de Drive. Cuando en una producción
 * tocan varios músicos, el previo que necesitan es el mismo, y hasta ahora la
 * única forma de mandárselo al segundo era volver a renderizar diez minutos
 * para producir un mp3 idéntico.
 *
 * Tempo y tonalidad se muestran pero NO se editan: el archivo ya existe y se
 * llama `4-6 A 9 124bpm Em.mp3`. Decir otra cosa en el correo sería mentir
 * sobre lo que va a oír.
 */
export function MandarPrevioMusico({ job, proyectoId, musicos, yaLoTienen, onCerrar }: {
  job: RenderJobResumen;
  proyectoId: string;
  /** Todos los activos. Los que no tienen correo salen deshabilitados, no ocultos. */
  musicos: MusicoLite[];
  /** musico_id → fecha del previo que ya se le mandó de este mismo archivo. */
  yaLoTienen: Map<string, string>;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [deVenta, setDeVenta] = useState<DeVenta[]>([]);
  const [musicoId, setMusicoId] = useState("");
  const [instrumento, setInstrumento] = useState("");
  const [nota, setNota] = useState("");
  const [asignar, setAsignar] = useState(true);
  const [busy, setBusy] = useState(false);

  const op = job.opciones ?? {};
  const bpm = Number(op.bpm) || null;
  const tonalidad = String(op.tonalidad ?? "").trim() || null;

  // Quién se contrató para ESTE proyecto: resuelve la ambigüedad del catálogo,
  // donde hay dos tololoches y dos trombones. Si falla, quedan los de abajo.
  useEffect(() => {
    let vivo = true;
    fetch(`/api/admin/musicos-de-venta?proyecto_id=${proyectoId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { musicos: [] }))
      .then((d) => { if (vivo) setDeVenta((d.musicos ?? []) as DeVenta[]); })
      .catch(() => { /* se sigue con el catálogo completo */ });
    return () => { vivo = false; };
  }, [proyectoId]);

  const elegido = musicos.find((m) => m.id === musicoId) ?? null;
  const deVentaElegido = deVenta.find((m) => m.id === musicoId) ?? null;
  const yaLoTiene = musicoId ? yaLoTienen.get(musicoId) ?? null : null;
  // Se le mandó a este mismo, no hay a quién reenviárselo.
  const esElMismo = musicoId !== "" && musicoId === job.musico_id;
  const sinCorreo = Boolean(elegido && !String(elegido.email ?? "").trim());
  const sinPortal = Boolean(asignar && elegido && !elegido.portalActivo);

  const listo = !!musicoId && !esElMismo && !sinCorreo && !sinPortal && (!asignar || instrumento.trim() !== "") && !busy;

  const elegir = (id: string) => {
    setMusicoId(id);
    // Lo que dice la venta manda; si no está ahí, su primer instrumento del catálogo.
    const v = deVenta.find((x) => x.id === id);
    const c = musicos.find((x) => x.id === id);
    setInstrumento(v?.instrumento || c?.instrumentos[0] || "");
  };

  const mandar = async () => {
    if (!listo) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/previo-musico", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, musicoId, instrumento: instrumento.trim(), nota: nota.trim(), asignar }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo mandar"}`); return; }
      // Las dos mitades por separado: mandar el previo y dejárselo en el portal
      // son dos escrituras distintas, y callar la que falla es lo que deja a un
      // músico con el correo en la mano y el portal vacío.
      if (!d.avisado) toast(`⚠️ Se registró, pero NO salió el correo${d.omitido ? `: ${d.omitido}` : ""}`);
      else if (asignar && !d.asignado) toast(`⚠️ Le llegó el correo a ${d.avisado}, pero NO quedó en su portal`);
      else toast(`✓ Se lo mandamos a ${d.avisado}${d.asignado ? " y ya lo tiene en su portal" : ""}`);
      onCerrar();
      router.refresh();
    } catch {
      toast("⚠️ No se pudo mandar");
    } finally { setBusy(false); }
  };

  const tieneCorreo = (m: MusicoLite) => Boolean(String(m.email ?? "").trim());
  const sueltos = musicos.filter((m) => tieneCorreo(m) && m.id !== job.musico_id && !deVenta.some((v) => v.id === m.id));
  const sinCorreoLista = musicos.filter((m) => !tieneCorreo(m));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCerrar}>
      <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl bg-lgb-dark border border-white/10"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <p className="font-coolvetica text-lg">Mandar este previo a otro músico</p>
            <p className="text-white/40 text-xs mt-0.5">
              Del {dia(job.created_at)}
              {job.musico_nombre ? ` · se le mandó a ${job.musico_nombre}` : ""}
              {bpm && tonalidad ? ` · ${bpm}bpm en ${tonalidad}` : ""}
            </p>
          </div>
          <button onClick={onCerrar} className="text-white/40 hover:text-white cursor-pointer shrink-0"><X size={18} /></button>
        </div>

        <div className="px-5 pb-5 space-y-3">
          <p className="text-[11px] text-white/35 leading-relaxed">
            Es el mismo archivo que ya está en Drive — no se vuelve a renderizar, no se ocupa REAPER.
          </p>

          <div>
            <label className={lbl}>A quién</label>
            <select value={musicoId} onChange={(e) => elegir(e.target.value)} className={inp}>
              <option value="" className="bg-lgb-dark">— elige —</option>
              {deVenta.filter((m) => m.tieneCorreo && m.id !== job.musico_id).length > 0 && (
                <optgroup label="Contratados en esta venta" className="bg-lgb-dark">
                  {deVenta.filter((m) => m.tieneCorreo && m.id !== job.musico_id).map((m) => (
                    <option key={m.id} value={m.id} className="bg-lgb-dark">
                      {m.nombre}{m.instrumento ? ` — ${m.instrumento}` : ""}
                      {yaLoTienen.has(m.id) ? "  (ya lo tiene)" : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Los demás con correo" className="bg-lgb-dark">
                {sueltos.map((m) => (
                  <option key={m.id} value={m.id} className="bg-lgb-dark">
                    {m.nombre}{m.instrumentos.length ? ` — ${m.instrumentos.join(", ")}` : ""}
                    {yaLoTienen.has(m.id) ? "  (ya lo tiene)" : ""}
                  </option>
                ))}
              </optgroup>
              {sinCorreoLista.length > 0 && (
                // Salen visibles y deshabilitados a propósito: si no aparecieran,
                // buscarlos en la lista y no encontrarlos se lee como un error.
                <optgroup label="Sin correo — no se les puede mandar" className="bg-lgb-dark">
                  {sinCorreoLista.map((m) => (
                    <option key={m.id} value={m.id} disabled className="bg-lgb-dark">{m.nombre}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {yaLoTiene && (
            <p className="text-[11px] text-amber-300/80 flex items-center gap-1.5">
              <Check size={12} /> Ya se lo mandaste el {dia(yaLoTiene)}. Mandarlo otra vez le llega otro correo.
            </p>
          )}
          {sinCorreo && (
            <p className="text-[11px] text-amber-300/80 flex items-center gap-1.5">
              <MailX size={12} /> No tiene correo registrado. Agrégaselo en Ajustes → Músicos.
            </p>
          )}

          <div>
            <label className={lbl}>Indicaciones <span className="text-white/25">(salen destacadas en el correo)</span></label>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={1000}
              placeholder="Entra en el segundo coro, deja aire en los versos…" className={inp} />
          </div>

          <label className={`flex items-start gap-2 text-xs cursor-pointer rounded-lg px-2.5 py-2 border transition-colors ${
            asignar ? "bg-lgb-red/10 border-lgb-red/40" : "bg-white/5 border-transparent hover:bg-white/10"
          }`}>
            <input type="checkbox" checked={asignar} onChange={(e) => setAsignar(e.target.checked)}
              className="accent-lgb-red mt-0.5" />
            <span className="text-white/70">
              Déjaselo también en su portal
              <span className="block text-white/35 text-[11px]">Sin esto le llega el correo pero no puede subirte su grabación.</span>
            </span>
          </label>

          {asignar && (
            <div>
              <label className={lbl}>Qué va a grabar</label>
              <input value={instrumento} onChange={(e) => setInstrumento(e.target.value)} maxLength={40}
                placeholder="Bass" className={inp} />
              {deVentaElegido?.instrumento && (
                <p className="text-[11px] text-white/25 mt-1">Es para lo que se le contrató en esta venta.</p>
              )}
            </div>
          )}
          {sinPortal && (
            <p className="text-[11px] text-amber-300/80">
              No tiene el portal prendido. Actívaselo en Ajustes → Músicos, o desmarca la casilla.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={mandar} disabled={!listo}
              className="flex items-center gap-1.5 bg-lgb-red text-white px-3.5 py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-40 cursor-pointer">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {yaLoTiene ? "Volver a mandárselo" : "Mandárselo"}
            </button>
            <button onClick={onCerrar} className="text-white/50 hover:text-white text-sm px-2 cursor-pointer">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
