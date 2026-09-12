"use client";
import { Check, Lock, PackageCheck, RotateCcw, Cloud } from "lucide-react";
import type { EstadoEntrega, JobEntrega } from "@/lib/pasos-entrega";
import { abrirEntrega } from "@/lib/entrega-cliente";

const ETIQUETA: Record<JobEntrega["tipo"], string> = { entregables: "Entregables", stems: "Stems" };

const peso = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

/** Un puntito por render: el color dice en qué va, sin tener que leer nada. */
function colorDe(j: JobEntrega): string {
  if (j.estado === "error") return "bg-red-400";
  if (j.enDrive) return "bg-green-400";
  if (j.estado === "renderizando") return "bg-amber-400 animate-pulse";
  if (j.estado === "subiendo" || j.estado === "listo") return "bg-sky-400 animate-pulse";
  return "bg-white/25";
}

function textoDe(j: JobEntrega): string {
  if (j.estado === "error") return "falló — toca para volver a intentar";
  if (j.enDrive) return "en Drive";
  if (j.estado === "renderizando") return "renderizando en REAPER…";
  if (j.estado === "subiendo" || j.estado === "listo") return "subiendo a Drive…";
  return j.antes ? `en cola · ${j.antes} antes` : "en cola · es el que sigue";
}

/**
 * La píldora de la entrega, junto a "Subir a Drive".
 *
 *   ○ Entregables  ○ Stems                 en cola
 *   ● Entregables  ○ Stems                 renderizando (late)
 *   ● Entregables  ● Stems  ☁ en Drive     subió
 *   ● Entregables  ● Stems  🔒 esperando pago / ✓ con el cliente
 *
 * Sin entrega todavía y con el paso abierto: "Preparar entrega", que abre el
 * mismo cuadro. Así también sirve en los proyectos viejos que nunca tuvieron
 * una tarea "Aprobada".
 */
export function EntregaEstado({ e, saldo, titulo }: {
  e: EstadoEntrega;
  /** Sólo se pasa a quien puede ver dinero: sin él dice "esperando pago" a secas. */
  saldo?: number | null;
  titulo?: string;
}) {
  const abrir = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    abrirEntrega({ proyectoId: e.proyectoId, tareaId: e.tareaId, titulo });
  };

  if (!e.jobs.length) {
    if (!e.abierto) return null;
    // Todavía no está en revisión: se ve, pero apagado, y dice por qué.
    if (!e.habilitado) {
      return (
        <span title={e.porQue ?? undefined} onClick={(ev) => ev.stopPropagation()}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/25 cursor-not-allowed">
          <PackageCheck size={10} /> Preparar entrega
        </span>
      );
    }
    return (
      <button onClick={abrir} title="Sacar entregables y stems y subirlos a Drive"
        className="shrink-0 inline-flex items-center gap-1 rounded-full border border-lgb-red/30 bg-lgb-red/10 px-2 py-0.5 text-[10px] text-lgb-red hover:bg-lgb-red/20 transition-colors cursor-pointer">
        <PackageCheck size={10} /> Preparar entrega
      </button>
    );
  }

  const fallo = e.jobs.some((j) => j.estado === "error");
  const todos = e.jobs.every((j) => j.enDrive);

  const cierre = fallo ? (
    <span className="inline-flex items-center gap-0.5 text-red-300"><RotateCcw size={9} /> reintentar</span>
  ) : todos && e.compartido ? (
    <span className="inline-flex items-center gap-0.5 text-green-300"><Check size={10} /> con el cliente</span>
  ) : todos && e.retenido ? (
    <span className="inline-flex items-center gap-0.5 text-amber-300">
      <Lock size={9} /> esperando pago{saldo && saldo > 0.5 ? ` · ${peso(saldo)}` : ""}
    </span>
  ) : todos ? (
    <span className="inline-flex items-center gap-0.5 text-sky-300"><Cloud size={10} /> en Drive</span>
  ) : null;

  const cuerpo = (
    <>
      {e.jobs.map((j) => (
        <span key={j.id} className="inline-flex items-center gap-1" title={`${ETIQUETA[j.tipo]}: ${textoDe(j)}`}>
          <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-700 ${colorDe(j)}`} />
          {ETIQUETA[j.tipo]}
        </span>
      ))}
      {cierre && <span className="text-white/15">·</span>}
      {cierre}
    </>
  );

  const clase = "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] text-white/55 transition-colors";
  return fallo ? (
    <button onClick={abrir} className={`${clase} border-red-400/30 bg-red-500/[0.06] hover:bg-red-500/[0.12] cursor-pointer`}>{cuerpo}</button>
  ) : (
    <span className={`${clase} ${todos && e.compartido ? "border-green-400/20 bg-green-500/[0.05]" : "border-white/10 bg-white/[0.04]"}`}>{cuerpo}</span>
  );
}
