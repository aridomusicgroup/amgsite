"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Music4, Package, Layers, Loader2, Music2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { RenderOpciones } from "./RenderOpciones";
import type { Renderizable, TipoRender, RenderJob, OpcionesRender, MusicoLite } from "@/lib/render-jobs";

/**
 * Lo que comparten la lista de REAPER y la ficha de un proyecto: los cuatro
 * botones de render, el cuadro de opciones y el renglón de "en curso". Viven
 * aquí para que las dos pantallas encolen exactamente igual — dos copias de
 * `enviar` acabarían diciendo cosas distintas en el toast.
 */

/** Estados que significan "hay algo corriendo, no pidas otro". */
export const EN_VUELO = ["pendiente", "renderizando", "subiendo"];

/**
 * Cuánto tarda cada render, medido sobre canciones reales de ~3 min con la
 * cadena de plugins completa. Se muestra en pantalla porque sin esto un
 * "en cola" de 12 minutos se ve idéntico a que algo se trabó.
 */
export const MINUTOS: Record<TipoRender, number> = { previo: 4, entregables: 10, stems: 6, musico: 4, cuantizar: 2 };

export const TIPO_TXT: Record<string, string> = { previo: "Previo", entregables: "Entregables", stems: "Stems", musico: "Previo músico", cuantizar: "Cuadrar a la rejilla" };

/** Encola un render desde el cuadro de opciones y dice cómo quedó. */
export function useEncolarRender() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  // Qué cuadro de opciones está abierto. Se abre al picarle a un botón y ahí se
  // elige el .rpp base, el rango y (en stems) las pistas.
  const [abierto, setAbierto] = useState<{ p: Renderizable; tipo: TipoRender } | null>(null);

  const enviar = async (p: Renderizable, tipo: TipoRender, opciones: OpcionesRender) => {
    setEnviando(true);
    try {
      const res = await fetch("/api/admin/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId: p.proyectoId, tareaId: p.tareaId, tipo, opciones }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Error");
      // Se dice si quedó o no en su portal. Que esto pase callado fue lo que
      // dejó a Martín con el correo del previo y el portal vacío durante días.
      const cuantos = (opciones.musicosExtra?.length ?? 0) + 1;
      if (cuantos > 1) {
        toast(`✓ En cola — al terminar le llega a los ${cuantos} músicos`);
      } else if (opciones.asignar && !d.asignado) {
        toast("⚠️ El render quedó en cola, pero NO se le pudo dejar en su portal. Asígnaselo desde la tarea.");
      } else if (d.asignado) {
        toast("✓ En cola, y ya lo tiene en su portal");
      } else {
        toast("✓ En cola — REAPER lo toma en menos de 2 min");
      }
      setAbierto(null);
      router.refresh();
    } catch (e) {
      toast(`⚠️ ${e instanceof Error ? e.message : "No se pudo encolar"}`);
    } finally {
      setEnviando(false);
    }
  };

  const abrir = (p: Renderizable, tipo: TipoRender) => setAbierto({ p, tipo });

  const cuadro = (musicos: MusicoLite[]) =>
    abierto && (
      <RenderOpciones
        p={abierto.p}
        tipo={abierto.tipo}
        musicos={musicos}
        enviando={enviando}
        onCerrar={() => !enviando && setAbierto(null)}
        onConfirmar={(op) => enviar(abierto.p, abierto.tipo, op)}
      />
    );

  return { abrir, cuadro };
}

/** Los cuatro botones: músico, previo, entregables, stems. */
export function BotonesRender({ p, onAbrir }: { p: Renderizable; onAbrir: (p: Renderizable, t: TipoRender) => void }) {
  const enVuelo = p.jobs.some((j) => EN_VUELO.includes(j.estado));
  return (
    <>
      <BotonRender
        icono={<Music2 size={14} />}
        texto="Músico"
        titulo={`Previo para quien graba: MP3 con BPM y tonalidad en el nombre · tarda ~${MINUTOS.musico} min`}
        deshabilitado={enVuelo}
        onClick={() => onAbrir(p, "musico")}
      />
      <BotonRender
        icono={<Music4 size={14} />}
        texto={p.ultimoPrevio > 0 ? `Previo ${p.ultimoPrevio + 1}` : "Previo"}
        titulo={`MP3 128 kbps / 44.1 kHz · tarda ~${MINUTOS.previo} min`}
        deshabilitado={enVuelo}
        onClick={() => onAbrir(p, "previo")}
      />
      <BotonRender
        icono={<Package size={14} />}
        texto="Entregables"
        titulo={`MP3 320 kbps / 48 kHz + WAV 32-bit · tarda ~${MINUTOS.entregables} min`}
        deshabilitado={enVuelo}
        onClick={() => onAbrir(p, "entregables")}
      />
      <BotonRender
        icono={<Layers size={14} />}
        texto="Stems"
        titulo={`WAV 24-bit por grupo, con mezcla y máster · tarda ~${MINUTOS.stems} min`}
        deshabilitado={enVuelo}
        onClick={() => onAbrir(p, "stems")}
      />
    </>
  );
}

export function BotonRender({ icono, texto, titulo, deshabilitado, onClick }: {
  icono: React.ReactNode; texto: string; titulo?: string; deshabilitado: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={deshabilitado ? "Espera a que termine el render en curso" : titulo}
      disabled={deshabilitado}
      className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {icono}
      {texto}
    </button>
  );
}

/**
 * Estado de un render en curso, con el tiempo que lleva y el que se espera.
 *
 * El reloj corre en el cliente: sin él, un trabajo largo se ve congelado y la
 * reacción natural es volver a picarle o pensar que se rompió (ya pasó).
 */
export function EnCurso({ job }: { job: RenderJob }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  const min = Math.max(0, Math.floor((ahora - new Date(job.createdAt).getTime()) / 60000));
  const esperado = MINUTOS[job.tipo] ?? 8;
  const tarde = min > esperado + 5;

  const detalle =
    job.estado === "pendiente"
      ? "en cola — REAPER lo toma en menos de 2 min"
      : job.estado === "subiendo"
        ? "subiendo a Drive…"
        : `renderizando… (suele tardar ~${esperado} min)`;

  return (
    <p className={`text-[11px] mt-2 flex items-center gap-1.5 ${tarde ? "text-red-300" : "text-amber-300"}`}>
      <Loader2 size={12} className="animate-spin" />
      {TIPO_TXT[job.tipo] ?? job.tipo} · {detalle} · lleva {min} min
      {tarde && " · más de lo normal, revisa la Consola"}
    </p>
  );
}
