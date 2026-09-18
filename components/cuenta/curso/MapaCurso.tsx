"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import type { ModuloCliente, LeccionCliente } from "@/lib/cursos-cliente";
import { ETIQUETA_DE, cuentaParaAvance, formatoTiempo } from "@/lib/cursos-tipos";

type Vista = "principal" | "profunda" | "evaluacion" | "capsula";

const VISTAS: { id: Vista; label: string; ayuda: string }[] = [
  { id: "principal", label: "Ruta principal", ayuda: "Lo que necesitas para terminar el curso." },
  { id: "profunda", label: "📚 Profunda", ayuda: "Teoría a fondo, para cuando te dé curiosidad. Opcional." },
  { id: "evaluacion", label: "🏆 Evaluaciones", ayuda: "Demuestra lo aprendido. Opcional, pero te da el certificado con mención." },
  { id: "capsula", label: "⚡ Datos Crack", ayuda: "Ciencia de la docerola en 45 segundos." },
];

const enVista = (l: LeccionCliente, v: Vista): boolean => {
  if (v === "principal") return cuentaParaAvance(l) || (l.opcional && (l.etiqueta === "nucleo" || l.etiqueta === "herramienta" || l.etiqueta === "filosofia"));
  if (v === "profunda") return l.etiqueta === "profunda";
  if (v === "evaluacion") return l.etiqueta === "evaluacion";
  return l.etiqueta === "capsula";
};

/** El mapa del curso por rutas: principal, profunda, evaluaciones y Datos Crack. */
export function MapaCurso({ cursoId, modulos }: { cursoId: string; modulos: ModuloCliente[] }) {
  const [vista, setVista] = useState<Vista>("principal");
  const todas = modulos.flatMap((m) => m.lecciones);
  const cuenta = (v: Vista) => todas.filter((l) => enVista(l, v)).length;
  const def = VISTAS.find((v) => v.id === vista)!;

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 -mx-1 px-1 scroll-sutil" role="tablist">
        {VISTAS.map((v) => {
          const n = cuenta(v.id);
          if (!n && v.id !== "principal") return null;
          return (
            <button key={v.id} role="tab" aria-selected={vista === v.id} onClick={() => setVista(v.id)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer ${vista === v.id ? "bg-white text-black" : "bg-white/8 text-white/70 hover:text-white"}`}>
              {v.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-white/50 mb-5">{def.ayuda}</p>

      <div className="flex flex-col gap-7">
        {modulos.map((m) => {
          const lecciones = m.lecciones.filter((l) => enVista(l, vista));
          if (!lecciones.length && vista !== "principal") return null;
          return (
            <section key={m.id}>
              <h2 className="font-coolvetica text-lg">{m.titulo}</h2>
              {m.descripcion && <p className="text-white/50 text-xs mt-0.5 mb-2.5">{m.descripcion}</p>}
              <div className="flex flex-col gap-2 mt-2">
                {lecciones.map((l) => {
                  const et = ETIQUETA_DE[l.etiqueta];
                  return (
                    <Link key={l.id} href={`/cuenta/curso/${cursoId}/leccion/${l.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 hover:border-white/20 transition-colors">
                      <span className="w-5 text-center shrink-0" aria-label={et?.label}>{et?.emoji}</span>
                      <span className="flex-1 min-w-0 text-sm">{l.titulo}</span>
                      {l.opcional && l.etiqueta !== "capsula" && l.etiqueta !== "profunda" && l.etiqueta !== "evaluacion" && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 shrink-0">opcional</span>
                      )}
                      {l.duracionSeg ? <span className="text-[11px] text-white/40 shrink-0">{formatoTiempo(l.duracionSeg)}</span> : null}
                      {l.visto && <Check size={15} className="text-green-400 shrink-0" aria-label="Vista" />}
                    </Link>
                  );
                })}
                {lecciones.length === 0 && (
                  <p className="flex items-center gap-1.5 text-white/40 text-xs"><Lock size={12} /> Contenido en camino.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
