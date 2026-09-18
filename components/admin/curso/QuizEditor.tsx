"use client";
import { Plus, Trash2 } from "lucide-react";
import type { PreguntaQuiz, RangoDiagnostico, CriterioRubrica, Recurso } from "@/lib/cursos-tipos";
import { NIVELES_RUBRICA } from "@/lib/cursos-tipos";
import { inp, lblS } from "@/components/admin/tareas/estilos";
import { indicacion } from "./GuionTab";

const btnMas = "flex items-center gap-1.5 text-white/60 hover:text-white text-xs cursor-pointer";
const btnQuitar = "text-white/30 hover:text-red-400 cursor-pointer shrink-0";

/** Preguntas de opción múltiple (con explicación y audio opcional) + rangos de diagnóstico. */
export function QuizEditor({ preguntas, diagnostico, diagOriginal, recursos, onPreguntas, onDiagnostico }: {
  preguntas: PreguntaQuiz[];
  diagnostico: RangoDiagnostico[];
  /** Los rangos tal como venían (con sus indicaciones [RELLENAR]) para el placeholder. */
  diagOriginal: RangoDiagnostico[];
  recursos: Recurso[];
  onPreguntas: (p: PreguntaQuiz[]) => void;
  onDiagnostico: (d: RangoDiagnostico[]) => void;
}) {
  const set = (i: number, cambios: Partial<PreguntaQuiz>) => onPreguntas(preguntas.map((p, j) => (j === i ? { ...p, ...cambios } : p)));
  const audios = recursos.map((r, i) => ({ r, i })).filter(({ r }) => r.tipo === "audio");

  return (
    <div className="flex flex-col gap-4">
      {preguntas.map((p, i) => (
        <div key={i} className="rounded-xl border border-white/10 p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input value={p.pregunta} onChange={(e) => set(i, { pregunta: e.target.value })} placeholder={`Pregunta ${i + 1}`} className={inp} />
            <button onClick={() => onPreguntas(preguntas.filter((_, j) => j !== i))} aria-label="Quitar pregunta" className={btnQuitar}><Trash2 size={14} /></button>
          </div>
          {p.opciones.map((o, k) => (
            <div key={k} className="flex items-center gap-2">
              <input type="radio" name={`correcta-${i}`} checked={p.correcta === k} onChange={() => set(i, { correcta: k })} aria-label="Respuesta correcta" className="accent-green-500 shrink-0" />
              <input value={o} onChange={(e) => set(i, { opciones: p.opciones.map((x, m) => (m === k ? e.target.value : x)) })} placeholder={`Opción ${k + 1}`} className={inp} />
              {p.opciones.length > 2 && (
                <button aria-label="Quitar opción" className={btnQuitar}
                  onClick={() => set(i, { opciones: p.opciones.filter((_, m) => m !== k), correcta: p.correcta >= k && p.correcta > 0 ? p.correcta - 1 : p.correcta })}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {p.opciones.length < 6 && <button onClick={() => set(i, { opciones: [...p.opciones, ""] })} className={btnMas}><Plus size={13} /> Opción</button>}
          <input value={p.explicacion ?? ""} onChange={(e) => set(i, { explicacion: e.target.value })} placeholder="Explicación (se muestra al calificar)" className={inp} />
          {audios.length > 0 && (
            <select value={p.audio ?? ""} onChange={(e) => set(i, { audio: e.target.value === "" ? undefined : Number(e.target.value) })} className={inp} aria-label="Audio de la pregunta">
              <option value="">Sin audio</option>
              {audios.map(({ r, i: idx }) => <option key={idx} value={idx}>🎧 {r.titulo}</option>)}
            </select>
          )}
        </div>
      ))}
      <button onClick={() => onPreguntas([...preguntas, { pregunta: "", opciones: ["", ""], correcta: 0 }])} className={btnMas}>
        <Plus size={13} /> Pregunta
      </button>

      <div className="border-t border-white/10 pt-3">
        <p className={lblS}>Diagnóstico (opcional): en vez de aprobar/reprobar, recomienda una ruta según el puntaje</p>
        {diagnostico.map((r, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input type="number" min={0} max={100} value={r.min} aria-label="Desde %"
              onChange={(e) => onDiagnostico(diagnostico.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)))}
              className={`${inp} w-20 shrink-0`} />
            <input value={r.texto} placeholder={indicacion(diagOriginal[i]?.texto) || "Recomendación"}
              onChange={(e) => onDiagnostico(diagnostico.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
              className={inp} />
            <button onClick={() => onDiagnostico(diagnostico.filter((_, j) => j !== i))} aria-label="Quitar rango" className={btnQuitar}><Trash2 size={13} /></button>
          </div>
        ))}
        <button onClick={() => onDiagnostico([...diagnostico, { min: 0, texto: "" }])} className={btnMas}><Plus size={13} /> Rango (desde %)</button>
      </div>
    </div>
  );
}

/** Criterios de la rúbrica con sus 4 niveles (En camino → Profesional). */
export function RubricaEditor({ rubrica, original, onChange }: {
  rubrica: CriterioRubrica[];
  /** La rúbrica como venía (con indicaciones [RELLENAR]) para los placeholders. */
  original: CriterioRubrica[];
  onChange: (r: CriterioRubrica[]) => void;
}) {
  const set = (i: number, c: Partial<CriterioRubrica>) => onChange(rubrica.map((r, j) => (j === i ? { ...r, ...c } : r)));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-white/40 text-[11px]">El alumno se autoevalúa con esto antes de enviar; tú calificas con lo mismo al revisar.</p>
      {rubrica.map((r, i) => (
        <div key={i} className="rounded-xl border border-white/10 p-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input value={r.criterio} onChange={(e) => set(i, { criterio: e.target.value })} placeholder="Criterio (ej. Tempo y pulso)" className={inp} />
            <button onClick={() => onChange(rubrica.filter((_, j) => j !== i))} aria-label="Quitar criterio" className={btnQuitar}><Trash2 size={14} /></button>
          </div>
          {NIVELES_RUBRICA.map((nivel, k) => (
            <label key={nivel} className="block">
              <span className={lblS}>{k + 1} · {nivel}</span>
              <input value={r.niveles[k] ?? ""} placeholder={indicacion(original[i]?.niveles[k]) || "Cómo se ve este nivel"}
                onChange={(e) => {
                  const niveles = NIVELES_RUBRICA.map((_, m) => r.niveles[m] ?? "");
                  niveles[k] = e.target.value;
                  set(i, { niveles });
                }}
                className={inp} />
            </label>
          ))}
        </div>
      ))}
      <button onClick={() => onChange([...rubrica, { criterio: "", niveles: ["", "", "", ""] }])} className={btnMas}><Plus size={13} /> Criterio</button>
    </div>
  );
}
