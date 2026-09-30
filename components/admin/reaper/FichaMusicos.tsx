"use client";
import { useState } from "react";
import { Check, Circle, AlertCircle, Send, UserPlus, ExternalLink } from "lucide-react";
import type { RenderJob, Renderizable, TipoRender, MusicoLite } from "@/lib/render-jobs";
import type { RenderJobResumen } from "@/lib/erp-data";
import type { MusicoEnFicha } from "@/lib/reaper-ficha";
import { MandarPrevioMusico } from "../proyecto-detalle/MandarPrevioMusico";
import { Seccion, dia, type Tono } from "./ficha-ui";

const ASIGNACION_TXT: Record<string, string> = {
  pendiente: "tiene el trabajo en su portal",
  entregado: "ya entregó en su portal",
  aceptado: "entrega aceptada",
};

/** El formato que espera `MandarPrevioMusico` (el de la ficha del proyecto). */
function aResumen(j: RenderJob, nombres: Record<string, string>): RenderJobResumen {
  return {
    id: j.id, tipo: j.tipo, estado: j.estado, tarea_id: j.tareaId, created_at: j.createdAt,
    drive_urls: j.driveUrls, compartir: j.compartir, avisado_en: j.avisadoEn,
    musico_id: j.musicoId, musico_nombre: j.musicoId ? nombres[j.musicoId] ?? null : null,
    enlace_publico: j.enlacePublico, opciones: (j.opciones as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Cada músico de esta canción y hasta dónde va: le llegó el previo → tiene el
 * trabajo en su portal → subió su grabación → entró al proyecto de REAPER.
 *
 * Salen los contratados en la venta aunque no se les haya mandado nada todavía
 * — "a quién le falta el previo" es justo la pregunta que esto contesta.
 */
export function FichaMusicos({ item, musicos, catalogo, nombres, onAbrir }: {
  item: Renderizable;
  musicos: MusicoEnFicha[];
  catalogo: MusicoLite[];
  nombres: Record<string, string>;
  onAbrir: (p: Renderizable, t: TipoRender) => void;
}) {
  const [mandando, setMandando] = useState<RenderJob | null>(null);

  // El previo de músico más reciente que ya está en Drive: se le puede reenviar
  // a otro sin volver a renderizar.
  const reenviable = item.jobs.find((j) => j.tipo === "musico" && j.estado === "listo" && j.driveUrls?.length) ?? null;

  // A quién se le mandó ya ESE archivo, para que el cuadro diga "ya lo tiene".
  const yaLoTienen = new Map<string, string>();
  const archivo = reenviable?.driveUrls?.[0]?.id;
  for (const j of item.jobs) {
    if (j.musicoId && archivo && j.driveUrls?.[0]?.id === archivo && !yaLoTienen.has(j.musicoId)) {
      yaLoTienen.set(j.musicoId, j.createdAt);
    }
  }

  const mandarPrevio = () => (reenviable ? setMandando(reenviable) : onAbrir(item, "musico"));

  return (
    <Seccion id="musicos" titulo="Músicos"
      extra={
        <button onClick={mandarPrevio}
          title={reenviable ? "Mandar el previo de músico que ya existe a otro músico, sin volver a renderizar" : "Renderizar un previo para quien graba"}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-white/8 text-white/70 hover:bg-white/12 hover:text-white transition-colors cursor-pointer">
          {reenviable ? <UserPlus size={11} /> : <Send size={11} />} {reenviable ? "Mandar previo a otro" : "Mandar previo"}
        </button>
      }>
      {musicos.length === 0 ? (
        <p className="text-xs text-white/35">
          Nadie contratado en la venta y no se le ha mandado previo a ningún músico.
        </p>
      ) : (
        <div className="space-y-1.5">
          {musicos.map((m) => (
            <RenglonMusico key={m.musicoId} m={m} onMandar={mandarPrevio} />
          ))}
        </div>
      )}

      {mandando && (
        <MandarPrevioMusico
          job={aResumen(mandando, nombres)}
          proyectoId={item.proyectoId}
          musicos={catalogo}
          yaLoTienen={yaLoTienen}
          onCerrar={() => setMandando(null)}
        />
      )}
    </Seccion>
  );
}

function RenglonMusico({ m, onMandar }: { m: MusicoEnFicha; onMandar: () => void }) {
  const previo = m.previos[0] ?? null;
  const s = m.subidas;

  // Paso 1: el previo.
  const p1: Paso = previo
    ? previo.estado === "error"
      ? { tono: "error", txt: "el render del previo falló" }
      : previo.estado !== "listo"
        ? { tono: "pend", txt: "previo renderizándose" }
        : previo.avisadoEn
          ? { tono: "ok", txt: `previo enviado ${dia(previo.avisadoEn)}${m.previos.length > 1 ? ` (${m.previos.length} envíos)` : ""}` }
          : { tono: "pend", txt: `previo del ${dia(previo.fecha)}, sin correo` }
    : { tono: "nada", txt: "sin previo" };

  // Paso 2: el portal.
  const p2: Paso = m.asignacion
    ? { tono: m.asignacion.estado === "pendiente" ? "pend" : "ok", txt: ASIGNACION_TXT[m.asignacion.estado] ?? m.asignacion.estado }
    : { tono: "nada", txt: m.portalActivo ? "sin trabajo en su portal" : "sin portal" };

  // Paso 3: lo que subió.
  const p3: Paso = s.conError
    ? { tono: "error", txt: `${s.conError} archivo(s) con error` }
    : s.stems
      ? s.importados === s.stems
        ? { tono: "ok", txt: `${s.stems} pista(s) ya en REAPER` }
        : { tono: "pend", txt: `${s.stems} pista(s) · ${s.importados} en REAPER` }
      : s.previos
        ? { tono: "pend", txt: `subió ${s.previos} previo(s), aún sin pistas` }
        : { tono: "nada", txt: "no ha subido nada" };

  const enlace = previo?.url ?? null;

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-white/85 min-w-0 truncate">
          {m.nombre}
          {m.instrumento && <span className="text-white/40"> · {m.instrumento}</span>}
          {!m.contratado && <span className="text-[11px] text-white/30"> · no está en la venta</span>}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {enlace && (
            <a href={enlace} target="_blank" rel="noopener noreferrer" aria-label={`Escuchar el previo que se le mandó a ${m.nombre}`}
              title="Escuchar el previo que se le mandó" className="text-white/40 hover:text-white p-1">
              <ExternalLink size={13} />
            </a>
          )}
          {!previo && (
            <button onClick={onMandar}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-lgb-red text-white hover:bg-red-700 transition-colors cursor-pointer">
              <Send size={11} /> Mandarle previo
            </button>
          )}
        </div>
      </div>
      <ol className="mt-1.5 flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1">
        <PasoTxt p={p1} />
        <PasoTxt p={p2} />
        <PasoTxt p={p3} />
      </ol>
    </div>
  );
}

type Paso = { tono: Tono; txt: string };

const PASO_CLS: Record<Tono, string> = {
  ok: "text-green-300/90", pend: "text-amber-300/90", nada: "text-white/35", error: "text-red-300",
};

function PasoTxt({ p }: { p: Paso }) {
  const Icono = p.tono === "ok" ? Check : p.tono === "error" ? AlertCircle : Circle;
  return (
    <li className={`flex items-center gap-1 text-[11px] ${PASO_CLS[p.tono]}`}>
      <Icono size={p.tono === "ok" || p.tono === "error" ? 11 : 8} className="shrink-0" /> {p.txt}
    </li>
  );
}
