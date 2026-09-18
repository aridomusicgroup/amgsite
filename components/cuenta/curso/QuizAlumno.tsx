"use client";
import { useState } from "react";
import { Check, X, RotateCcw, Loader2, Headphones } from "lucide-react";
import type { PreguntaCliente } from "@/lib/cursos-cliente";

interface Resultado {
  correctas: number;
  total: number;
  pct: number;
  aprobado: boolean;
  recomendacion: string | null;
  correccion: { correcta: number; elegida: number | null; explicacion: string | null }[];
}

/**
 * Quiz del alumno. Las respuestas se califican en el servidor; aquí sólo se
 * eligen y luego se muestra la corrección con su explicación. Se puede
 * repetir cuantas veces quiera (se guarda el mejor puntaje).
 */
export function QuizAlumno({ cursoId, leccionId, preguntas, mejorPct, onAprobado }: {
  cursoId: string;
  leccionId: string;
  preguntas: PreguntaCliente[];
  mejorPct: number | null;
  onAprobado?: () => void;
}) {
  const [resp, setResp] = useState<(number | null)[]>(() => preguntas.map(() => null));
  const [res, setRes] = useState<Resultado | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!preguntas.length) return <p className="text-white/40 text-sm">Este quiz todavía no tiene preguntas.</p>;

  const faltan = resp.filter((r) => r == null).length;

  const calificar = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/cuenta/curso/${cursoId}/leccion/${leccionId}/quiz`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ respuestas: resp }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "No se pudo calificar.");
      setRes(data);
      if (data.aprobado) onAprobado?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo calificar."); }
    finally { setBusy(false); }
  };

  const reintentar = () => { setRes(null); setResp(preguntas.map(() => null)); };

  return (
    <div className="flex flex-col gap-4">
      {res ? (
        <div className={`rounded-2xl p-5 border ${res.aprobado ? "border-green-500/30 bg-green-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
          <p className="font-coolvetica text-3xl">{res.pct}%</p>
          <p className="text-sm text-white/70 mt-1">{res.correctas} de {res.total} correctas{res.aprobado && !res.recomendacion ? " · ¡Aprobado!" : ""}</p>
          {res.recomendacion && <p className="text-sm text-white/85 mt-3 leading-relaxed">{res.recomendacion}</p>}
          <button onClick={reintentar} className="mt-4 inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white cursor-pointer">
            <RotateCcw size={13} /> Intentar de nuevo
          </button>
        </div>
      ) : mejorPct != null && (
        <p className="text-xs text-white/50">Tu mejor intento: {mejorPct}%</p>
      )}

      <ol className="flex flex-col gap-4">
        {preguntas.map((p, i) => {
          const corr = res?.correccion[i];
          return (
            <li key={i} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <p className="text-sm font-medium mb-3"><span className="text-white/40 mr-1.5">{i + 1}.</span>{p.pregunta}</p>
              {p.audio != null && (
                <div className="flex items-center gap-2 mb-3">
                  <Headphones size={15} className="text-white/40 shrink-0" />
                  <audio controls preload="none" src={`/api/cuenta/curso/${cursoId}/leccion/${leccionId}/recurso/${p.audio}`} className="w-full h-9" />
                </div>
              )}
              <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={`Pregunta ${i + 1}`}>
                {p.opciones.map((o, k) => {
                  const elegida = resp[i] === k;
                  const esCorrecta = corr && corr.correcta === k;
                  const fallo = corr && elegida && corr.correcta !== k;
                  return (
                    <button key={k} role="radio" aria-checked={elegida} disabled={!!res}
                      onClick={() => setResp((prev) => prev.map((x, j) => (j === i ? k : x)))}
                      className={`flex items-center gap-2.5 text-left rounded-xl px-3.5 py-2.5 text-sm border transition-colors cursor-pointer disabled:cursor-default ${
                        esCorrecta ? "border-green-500/50 bg-green-500/10" : fallo ? "border-red-500/50 bg-red-500/10" : elegida ? "border-lgb-red bg-lgb-red/10" : "border-white/10 hover:border-white/25"}`}>
                      <span className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${elegida ? "border-lgb-red" : "border-white/30"}`}>
                        {elegida && <span className="w-2 h-2 rounded-full bg-lgb-red" />}
                      </span>
                      <span className="flex-1">{o}</span>
                      {esCorrecta && <Check size={15} className="text-green-400 shrink-0" />}
                      {fallo && <X size={15} className="text-red-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {corr?.explicacion && <p className="text-xs text-white/60 mt-3 leading-relaxed">{corr.explicacion}</p>}
            </li>
          );
        })}
      </ol>

      {!res && (
        <div className="flex items-center gap-3">
          <button onClick={calificar} disabled={busy || faltan > 0}
            className="inline-flex items-center gap-2 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer">
            {busy && <Loader2 size={15} className="animate-spin" />} Calificar
          </button>
          {faltan > 0 && <span className="text-xs text-white/40">Te falta{faltan === 1 ? "" : "n"} {faltan}</span>}
        </div>
      )}
      {err && <p className="text-sm text-red-400">{err}</p>}
    </div>
  );
}
