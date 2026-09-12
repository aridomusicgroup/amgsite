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
 * Con un solo candidato se elige solo y ni se pregunta; con varios, viene
 * puesto el TITULAR del catálogo (o lo que ya se eligió en la cotización).
 */
export const INSTRUMENTOS_COMUNES = [
  "Armonía", "Guitarra", "Requinto", "Bajoquinto", "Bajo sexto", "Bajoloche", "Bass",
  "Tololoche", "Charchetas", "Trombón", "Acordeón", "Batería", "Tuba", "Trompeta",
  "Saxofón", "Teclado", "Voz", "Coros",
];

const inp =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red";

export type Candidato = { id: string; nombre: string; portal: boolean; titular?: boolean };
export type MusicoElegido = { instrumento: string; musico_id: string };

export function InstrumentosPicker({ value, onChange, onMusicos, inicial, soloMusicos = false }: {
  value: string;
  onChange: (v: string) => void;
  /** Quién toca cada instrumento. Sin esta prop, el selector ni aparece. */
  onMusicos?: (v: MusicoElegido[]) => void;
  /** Lo que ya se había elegido (en la cotización): gana sobre el titular. */
  inicial?: MusicoElegido[] | null;
  /** Sólo "quién toca": sin chips ni lista de tareas (la cotización ya trae sus instrumentos). */
  soloMusicos?: boolean;
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

  /** Quién va en un instrumento con varios candidatos: lo escogido aquí → lo de la cotización → el titular. */
  const elegidoEn = (inst: string, cands: Candidato[]): string => {
    const valido = (id: string | undefined) => (id && cands.some((c) => c.id === id) ? id : "");
    return valido(quien[inst])
      || valido(inicial?.find((e) => e.instrumento.toLowerCase() === inst.toLowerCase())?.musico_id)
      || valido(cands.find((c) => c.titular)?.id);
  };

  /**
   * Lo elegido, avisando hacia arriba.
   *
   * Con UN candidato se da por elegido sin preguntar; con varios, el que esté
   * puesto (a mano, de la cotización o el titular). Si no hay ninguno, llega
   * vacío al servidor, que entonces no crea ningún pago — mejor que crear el
   * equivocado.
   */
  useEffect(() => {
    if (!onMusicos) return;
    const lista = value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const out: MusicoElegido[] = [];
    for (const inst of lista) {
      const cands = candidatos[inst] ?? [];
      const id = cands.length === 1 ? cands[0].id : elegidoEn(inst, cands);
      if (id) out.push({ instrumento: inst, musico_id: id });
    }
    onMusicos(out);
    // `onMusicos` se deja fuera a propósito: los llamadores la pasan en línea y
    // cambia de identidad en cada render, lo que dispararía un bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, candidatos, quien, inicial]);

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
      {!soloMusicos && (
        <>
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
        </>
      )}
      {conSelector && sel.length > 0 && (
        <div className={`space-y-1.5 ${soloMusicos ? "" : "pt-1"}`}>
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
                    value={elegidoEn(inst, lista)}
                    onChange={(e) => setQuien((q) => ({ ...q, [inst]: e.target.value }))}
                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-lgb-red cursor-pointer"
                  >
                    <option value="" className="bg-lgb-dark">— ¿quién lo toca? —</option>
                    {lista.map((c) => (
                      <option key={c.id} value={c.id} className="bg-lgb-dark">
                        {c.nombre}{c.titular ? " (titular)" : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
          {sel.some((i) => (candidatos[i] ?? []).length > 1 && !elegidoEn(i, candidatos[i])) && (
            <p className="text-[11px] text-amber-300/70">
              Si no eliges, no se le crea el pago pendiente a nadie de ese instrumento — es
              preferible a creárselo al que no fue. Marca un titular en Ajustes → Músicos para
              que se ponga solo.
            </p>
          )}
        </div>
      )}

      {!soloMusicos && sel.length > 0 && (
        <p className="text-[11px] text-white/40">Se crearán: {sel.map((s) => `Grabar ${s}`).join(" · ")}</p>
      )}
    </div>
  );
}
