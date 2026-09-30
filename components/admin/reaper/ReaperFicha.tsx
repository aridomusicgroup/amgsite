"use client";
import Link from "next/link";
import { ArrowUpRight, AlertTriangle } from "lucide-react";
import { useRealtimeRefresh } from "@/lib/useRealtimeRefresh";
import { ESTADO_PROY_LABEL, ESTADO_PROY_COLOR } from "@/lib/erp-data";
import type { MusicoLite, RenderJob } from "@/lib/render-jobs";
import type { FichaReaper, MusicoEnFicha } from "@/lib/reaper-ficha";
import { BotonesRender, EnCurso, EN_VUELO, TIPO_TXT, useEncolarRender } from "../RenderControles";
import { Cuadro, dia, type Tono } from "./ficha-ui";
import { FichaMusicos } from "./FichaMusicos";
import { FichaPrevios, FichaStems } from "./FichaRenders";
import { FichaEdicion, resumenEdicion, useEdicion } from "./FichaEdicion";

type Resumen = { txt: string; sub: string; tono: Tono };

function resumenMusicos(ms: MusicoEnFicha[]): Resumen {
  if (!ms.length) return { txt: "Sin músicos", sub: "nadie contratado en la venta", tono: "nada" };
  const conPrevio = ms.filter((m) => m.previos.some((p) => p.estado === "listo")).length;
  const grabaron = ms.filter((m) => m.subidas.stems > 0).length;
  return {
    txt: `${conPrevio} de ${ms.length} con previo`,
    sub: grabaron ? `${grabaron} ya subieron su grabación` : "nadie ha subido grabación",
    tono: conPrevio === ms.length ? (grabaron === ms.length ? "ok" : "pend") : "pend",
  };
}

function resumenCliente(jobs: RenderJob[]): Resumen {
  const previos = jobs.filter((j) => j.tipo === "previo");
  const visto = previos.find((j) => j.compartir);
  if (visto) {
    return {
      txt: visto.previoNum ? `Previo ${visto.previoNum} con él` : "Previo con él",
      sub: visto.avisadoEn ? `avisado ${dia(visto.avisadoEn)}` : "en su cuenta, sin correo",
      tono: "ok",
    };
  }
  if (previos.length) return { txt: `${previos.length} previo(s)`, sub: "ninguno compartido todavía", tono: "pend" };
  return { txt: "Sin previos", sub: "no se ha renderizado ninguno", tono: "nada" };
}

function resumenStems(jobs: RenderJob[]): Resumen {
  const stems = jobs.filter((j) => j.tipo === "stems");
  const entregados = stems.find((j) => j.compartir);
  if (entregados) {
    return { txt: "Stems con el cliente", sub: entregados.avisadoEn ? `avisado ${dia(entregados.avisadoEn)}` : "en su cuenta", tono: "ok" };
  }
  const ultimo = stems[0];
  if (ultimo && EN_VUELO.includes(ultimo.estado)) return { txt: "Renderizando", sub: "stems en curso", tono: "pend" };
  if (stems.some((j) => j.estado === "listo")) return { txt: "Stems listos", sub: "todavía no se le mandan", tono: "pend" };
  if (ultimo?.estado === "error") return { txt: "Falló", sub: "el último render de stems", tono: "error" };
  const ent = jobs.some((j) => j.tipo === "entregables" && j.compartir);
  return { txt: "Sin stems", sub: ent ? "los entregables ya los tiene" : "no se han renderizado", tono: "nada" };
}

/**
 * La ficha de REAPER de un proyecto: todo lo que salió de su carpeta y a quién
 * le llegó. Arriba, cuatro cuadros que contestan de un vistazo "¿en qué va?";
 * abajo, el detalle de cada uno con sus acciones.
 */
export function ReaperFicha({ ficha, musicos, miId }: { ficha: FichaReaper; musicos: MusicoLite[]; miId: string | null }) {
  const { item: p } = ficha;
  const { abrir, cuadro } = useEncolarRender();
  const edicion = useEdicion(p.proyectoId, p.tareaId);

  useRealtimeRefresh(`rt-reaper-${p.key}`, ["render_jobs", "render_inventario", "edicion_envios", "edicion_revisiones"]);

  const enVuelo = p.jobs.find((j) => EN_VUELO.includes(j.estado));
  const ultimoError = !enVuelo && p.jobs[0]?.estado === "error" ? p.jobs[0] : null;
  const rpp = p.inventario?.proyectos[0] ?? null;

  const rMus = resumenMusicos(ficha.musicos);
  const rCli = resumenCliente(p.jobs);
  const rSte = resumenStems(p.jobs);
  const rEdi = resumenEdicion(edicion.estado);

  return (
    <div className="space-y-4">
      <header className="bg-lgb-surface border border-white/5 rounded-2xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-start gap-3">
          <div className="min-w-0 flex-1">
            {p.album && <p className="text-[11px] text-white/40 uppercase tracking-wider mb-0.5">{p.album}</p>}
            <h1 className="font-coolvetica text-2xl sm:text-3xl break-words">{p.titulo}</h1>
            <p className="text-white/45 text-xs mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] ${ESTADO_PROY_COLOR[p.estado] ?? "bg-white/10 text-white/50"}`}>
                {ESTADO_PROY_LABEL[p.estado] ?? p.estado}
              </span>
              <span>{p.cliente}{p.folio && ` · ${p.folio}`}</span>
              {(p.bpm || rpp?.bpm) && <span>· {p.bpm ?? rpp?.bpm} bpm</span>}
              {(p.tonalidad || rpp?.tonalidad) && <span>· {p.tonalidad ?? rpp?.tonalidad}</span>}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              <Link href={`/admin/proyectos/${p.proyectoId}`} className="flex items-center gap-1 text-[11px] text-white/45 hover:text-white transition-colors">
                Proyecto completo <ArrowUpRight size={12} />
              </Link>
              <Link href={`/admin/produccion?destacar=${p.key}`} className="flex items-center gap-1 text-[11px] text-white/45 hover:text-white transition-colors">
                En Producción <ArrowUpRight size={12} />
              </Link>
              {p.inventario?.carpeta && (
                <span className="text-[11px] text-white/30 truncate max-w-full" title={p.inventario.carpeta}>
                  Carpeta: {p.inventario.carpeta.split(/[\\/]/).filter(Boolean).at(-1)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
            <BotonesRender p={p} onAbrir={abrir} />
          </div>
        </div>
        {enVuelo && <EnCurso job={enVuelo} />}
        {ultimoError && (
          <p className="text-[11px] text-red-300 mt-2 break-words">✗ {TIPO_TXT[ultimoError.tipo] ?? ultimoError.tipo}: {ultimoError.error}</p>
        )}
        {rpp?.problemas?.some((x) => x.sev === "alto") && (
          <p className="text-[11px] text-amber-300 mt-2 flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {rpp.problemas.filter((x) => x.sev === "alto").map((x) => x.msg).join(" · ")}
          </p>
        )}
      </header>

      <nav aria-label="Resumen" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Cuadro href="#musicos" etiqueta="Músicos" {...rMus} />
        <Cuadro href="#cliente" etiqueta="Cliente" {...rCli} />
        <Cuadro href="#stems" etiqueta="Stems" {...rSte} />
        <Cuadro href="#edicion" etiqueta="Cuantizar" {...rEdi} />
      </nav>

      <FichaMusicos item={p} musicos={ficha.musicos} catalogo={musicos} nombres={ficha.nombres} onAbrir={abrir} />
      <FichaPrevios jobs={p.jobs} nombres={ficha.nombres} />
      <FichaStems jobs={p.jobs} />
      <FichaEdicion
        proyectoId={p.proyectoId}
        tareaId={p.tareaId}
        titulo={p.titulo}
        estado={edicion.estado}
        recargar={edicion.cargar}
        cuadrar={p.jobs.filter((j) => j.tipo === "cuantizar")}
        miId={miId}
      />

      {cuadro(musicos)}
    </div>
  );
}
