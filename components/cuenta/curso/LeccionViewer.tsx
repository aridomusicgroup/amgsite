"use client";
import { useState } from "react";
import { ExternalLink, Check, CalendarClock, Video } from "lucide-react";
import type { LeccionCliente } from "@/lib/cursos-cliente";
import { ReproductorPractica } from "./ReproductorPractica";
import { TabInteractiva } from "./TabInteractiva";
import { QuizAlumno } from "./QuizAlumno";
import { EntregaReto } from "./EntregaReto";
import { useAhora } from "@/lib/useAhora";

/** Cuánto antes de la hora se muestra el botón para entrar a la sesión. */
const ABRE_ANTES_MIN = 30;

/**
 * El material de la lección según su tipo: video (reproductor de práctica),
 * PDF, enlace, tablatura que suena, quiz, entrega o sesión en vivo. El botón
 * “Marcar como vista” sólo aparece donde tiene sentido marcarla a mano.
 */
export function LeccionViewer({ cursoId, leccion }: { cursoId: string; leccion: LeccionCliente }) {
  const [visto, setVisto] = useState(leccion.visto);
  const [busy, setBusy] = useState(false);
  const base = `/api/cuenta/curso/${cursoId}/leccion/${leccion.id}`;
  const archivo = `${base}/archivo`;

  const marcar = async (v: boolean) => {
    setBusy(true);
    try {
      const r = await fetch(`${base}/progreso`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visto: v }) });
      if (r.ok) setVisto(v);
    } finally { setBusy(false); }
  };

  const guardarPosicion = (segundos: number) => {
    fetch(`${base}/progreso`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ segundos }), keepalive: true }).catch(() => {});
  };

  const quiz = leccion.datos.quiz as { pct?: number } | undefined;
  const manual = leccion.tipo !== "quiz" && leccion.tipo !== "entrega";

  return (
    <div className="flex flex-col gap-4">
      {leccion.tipo === "video" && (
        leccion.tieneArchivo
          ? <ReproductorPractica src={archivo} marcadores={leccion.marcadores} vertical={leccion.etiqueta === "capsula"}
              segundosIniciales={leccion.segundos} onPosicion={guardarPosicion} onTerminado={() => { if (!visto) marcar(true); }} />
          : <p className="rounded-2xl border border-white/10 p-6 text-center text-sm text-white/50">El video de esta lección viene en camino.</p>
      )}

      {leccion.tipo === "pdf" && leccion.tieneArchivo && (
        <iframe src={archivo} title={leccion.titulo} className="w-full h-[70vh] rounded-2xl border border-white/8 bg-white" />
      )}

      {leccion.tipo === "link" && leccion.urlExterna && (
        <a href={leccion.urlExterna} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-lgb-red text-white py-4 rounded-2xl text-sm font-medium hover:bg-red-700 transition-all">
          <ExternalLink size={16} /> Abrir material
        </a>
      )}

      {leccion.tipo === "tab" && (
        leccion.tieneArchivo
          ? <TabInteractiva src={archivo} />
          : <p className="rounded-2xl border border-white/10 p-6 text-center text-sm text-white/50">La tablatura viene en camino.</p>
      )}

      {leccion.tipo === "quiz" && (
        <QuizAlumno cursoId={cursoId} leccionId={leccion.id} preguntas={leccion.preguntas} mejorPct={quiz?.pct ?? null} onAprobado={() => setVisto(true)} />
      )}

      {leccion.tipo === "entrega" && <EntregaReto cursoId={cursoId} leccionId={leccion.id} rubrica={leccion.rubrica} />}

      {leccion.tipo === "en_vivo" && <SesionEnVivo leccion={leccion} archivo={archivo} guardarPosicion={guardarPosicion} />}

      {manual && (
        <button onClick={() => marcar(!visto)} disabled={busy}
          className={`self-start flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ${
            visto ? "bg-green-500/15 text-green-400" : "bg-white/8 text-white/70 hover:text-white"}`}>
          <Check size={15} /> {visto ? "Vista" : "Marcar como vista"}
        </button>
      )}
    </div>
  );
}

/** Sesión de la mentoría: antes, fecha y botón para entrar; después, su grabación. */
function SesionEnVivo({ leccion, archivo, guardarPosicion }: { leccion: LeccionCliente; archivo: string; guardarPosicion: (s: number) => void }) {
  const fecha = leccion.enVivo?.fechaHora ? new Date(leccion.enVivo.fechaHora) : null;
  const ahora = useAhora() ?? 0;
  const fin = fecha ? fecha.getTime() + (leccion.enVivo?.duracionMin ?? 90) * 60_000 : 0;
  const abierta = fecha && ahora >= fecha.getTime() - ABRE_ANTES_MIN * 60_000 && ahora <= fin;

  if (leccion.tieneArchivo) {
    return <ReproductorPractica src={archivo} marcadores={leccion.marcadores} segundosIniciales={leccion.segundos} onPosicion={guardarPosicion} />;
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm">
        <CalendarClock size={16} className="text-lgb-red" />
        {fecha
          ? fecha.toLocaleString("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }) + " (hora del centro de México)"
          : "Fecha por confirmar"}
      </p>
      {abierta && leccion.urlExterna ? (
        <a href={leccion.urlExterna} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-lgb-red text-white py-3 rounded-full text-sm font-medium hover:bg-red-700 transition-colors">
          <Video size={16} /> Entrar a la sesión
        </a>
      ) : (
        <p className="text-xs text-white/50">
          {fecha && ahora > fin ? "La grabación se sube aquí en cuanto esté lista." : `El botón para entrar aparece ${ABRE_ANTES_MIN} minutos antes.`}
        </p>
      )}
    </div>
  );
}
