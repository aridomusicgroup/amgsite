"use client";
import { useEffect, useState } from "react";

/**
 * Selector de instrumentos (chips + personalizado). Compartido por el panel de
 * Producción, Nueva venta y Convertir cotización en venta: cada instrumento
 * elegido genera una tarea "Grabar {instrumento}" en el proyecto.
 * `value` es la lista separada por comas (formato que espera la API).
 *
 * Además, cuando un instrumento lo puede tocar MÁS DE UNA persona del catálogo
 * —hay dos tololoches y dos trombones—, pregunta cuál. Sin eso, el servidor
 * creaba un pago pendiente para cada candidato y `ventas.costo_extra` (que
 * alimenta el reparto de socios) quedaba inflado con un costo que no existía.
 * Con un solo candidato se elige solo y ni se pregunta.
 */
export const INSTRUMENTOS_COMUNES = [
  "Armonía", "Guitarra", "Requinto", "Bajoquinto", "Bajo sexto", "Bajoloche", "Bass",
  "Tololoche", "Charchetas", "Trombón", "Acordeón", "Batería", "Tuba", "Trompeta",
  "Saxofón", "Teclado", "Voz", "Coros",
];

const inp =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";

export type Candidato = { id: string; nombre: string; portal: boolean };

export function InstrumentosPicker({ value, onChange, onMusicos }: {
  value: string;
  onChange: (v: string) => void;
  /** Quién toca cada instrumento. Sin esta prop, el selector ni aparece. */
  onMusicos?: (v: { instrumento: string; musico_id: string }[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const sel = value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);

  const [candidatos, setCandidatos] = useState<Record<string, Candidato[]>>({});
  const [quien, setQuien] = useState<Record<string, string>>({});
  const conSelector = Boolean(onMusicos);

  // Se piden los candidatos cada vez que cambia la lista de instrumentos.
  useEffect(() => {
    if (!conSelector || !value.trim()) { setCandidatos({}); return; }
    let vivo = true;
    fetch(`/api/admin/musicos-candidatos?instrumentos=${encodeURIComponent(value)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { candidatos: {} }))
      .then((d) => { if (vivo) setCandidatos(d.candidatos ?? {}); })
      .catch(() => { /* sin catálogo se sigue como antes */ });
    return () => { vivo = false; };
  }, [value, conSelector]);

  /**
   * Lo elegido, avisando hacia arriba.
   *
   * Con UN candidato se da por elegido sin preguntar; con varios, solo cuenta
   * si alguien escogió. Así un instrumento ambiguo sin resolver llega vacío al
   * servidor, que entonces no crea ningún pago — mejor que crear el equivocado.
   */
  useEffect(() => {
    if (!onMusicos) return;
    const lista = value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const out: { instrumento: string; musico_id: string }[] = [];
    for (const inst of lista) {
      const cands = candidatos[inst] ?? [];
      const id = cands.length === 1 ? cands[0].id : quien[inst];
      if (id && cands.some((c) => c.id === id)) out.push({ instrumento: inst, musico_id: id });
    }
    onMusicos(out);
    // `onMusicos` se deja fuera a propósito: los llamadores la pasan en línea y
    // cambia de identidad en cada render, lo que dispararía un bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, candidatos, quien]);

  const has = (i: string) => sel.some((s) => s.toLowerCase() === i.toLowerCase());
  const toggle = (i: string) =>
    onChange((has(i) ? sel.filter((s) => s.toLowerCase() !== i.toLowerCase()) : [...sel, i]).join(", "));
  const addCustom = () => {
    const c = custom.trim();
    if (c && !has(c)) onChange([...sel, c].join(", "));
    setCustom("");
  };
  // Instrumentos elegidos que no están en la lista común (ej. inferidos raros o custom)
  const extrasSel = sel.filter((s) => !INSTRUMENTOS_COMUNES.some((i) => i.toLowerCase() === s.toLowerCase()));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {INSTRUMENTOS_COMUNES.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
              has(i) ? "bg-lgb-red text-white" : "bg-white/5 text-white/50 hover:text-white"
            }`}
          >
            {i}
          </button>
        ))}
        {extrasSel.map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className="px-2.5 py-1 rounded-full text-xs bg-lgb-red text-white"
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="+ otro instrumento"
          className={inp}
        />
        <button type="button" onClick={addCustom} className="bg-white/10 hover:bg-white/15 text-white px-3 rounded-lg text-sm shrink-0">
          Add
        </button>
      </div>
      {conSelector && sel.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {sel.map((inst) => {
            const lista = candidatos[inst] ?? [];
            if (!lista.length) return null;
            return (
              <div key={inst} className="flex items-center gap-2">
                <span className="text-[11px] text-white/40 w-24 shrink-0 truncate">{inst}</span>
                {lista.length === 1 ? (
                  <span className="text-xs text-white/60">{lista[0].nombre}</span>
                ) : (
                  <select
                    value={quien[inst] ?? ""}
                    onChange={(e) => setQuien((q) => ({ ...q, [inst]: e.target.value }))}
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-lgb-red cursor-pointer"
                  >
                    <option value="" className="bg-lgb-dark">— ¿quién lo toca? —</option>
                    {lista.map((c) => (
                      <option key={c.id} value={c.id} className="bg-lgb-dark">{c.nombre}</option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
          {sel.some((i) => (candidatos[i] ?? []).length > 1 && !quien[i]) && (
            <p className="text-[11px] text-amber-300/70">
              Si no eliges, no se le crea el pago pendiente a nadie de ese instrumento — es
              preferible a creárselo al que no fue.
            </p>
          )}
        </div>
      )}

      {sel.length > 0 && (
        <p className="text-[11px] text-white/40">Se crearán: {sel.map((s) => `Grabar ${s}`).join(" · ")}</p>
      )}
    </div>
  );
}
