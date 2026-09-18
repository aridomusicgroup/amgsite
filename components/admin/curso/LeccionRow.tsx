"use client";
import { useState } from "react";
import Link from "next/link";
import { Trash2, ChevronUp, ChevronDown, Pencil, Clapperboard, Megaphone } from "lucide-react";
import type { CursoLeccion, CursoModulo } from "@/lib/cursos-admin";
import { ESTADOS_PRODUCCION, ETIQUETA_DE, TIPO_LABEL, TIPOS_CON_ARCHIVO, camposPendientes, type EstadoProduccion } from "@/lib/cursos-tipos";
import { toast } from "@/lib/toast";
import { api, errorDe } from "./api";
import { LeccionEditor } from "./LeccionEditor";

const COLOR_ESTADO: Record<EstadoProduccion, string> = {
  guion: "bg-white/8 text-white/50",
  listo_grabar: "bg-amber-500/15 text-amber-300",
  grabado: "bg-blue-500/15 text-blue-300",
  editado: "bg-green-500/15 text-green-400",
};

/** Correo de estreno: sólo con el curso ya lanzado; `avisadas` = lecciones ya avisadas. */
export interface Estrenos { habilitado: boolean; alumnos: number; avisadas: string[] }

/** Un renglón de lección: etiqueta, estado de grabación, publicada y acciones. */
export function LeccionRow({ cursoId, leccion, modulos, puedeMover, esPrimero, esUltimo, onMover, onChanged, estrenos }: {
  cursoId: string;
  estrenos: Estrenos;
  leccion: CursoLeccion;
  modulos: CursoModulo[];
  puedeMover: boolean;
  esPrimero: boolean;
  esUltimo: boolean;
  onMover: (dir: -1 | 1) => void;
  onChanged: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const et = ETIQUETA_DE[leccion.etiqueta] ?? ETIQUETA_DE.nucleo;
  const pendientes = leccion.tipo === "quiz" ? 0 : camposPendientes(leccion.contenido, leccion.etiqueta);
  const sinArchivo = TIPOS_CON_ARCHIVO.includes(leccion.tipo) && !leccion.driveFileId && leccion.tipo !== "en_vivo";

  const patch = async (body: Record<string, unknown>) => {
    try { await api("/api/admin/cursos/lecciones", "PATCH", { id: leccion.id, ...body }); onChanged(); }
    catch (e) { toast(errorDe(e)); }
  };

  const borrar = async () => {
    if (!confirm(`¿Borrar la lección "${leccion.titulo}" con su guion? No se puede deshacer.`)) return;
    try { await api("/api/admin/cursos/lecciones", "DELETE", { id: leccion.id }); onChanged(); }
    catch (e) { toast(errorDe(e)); }
  };

  const avisada = estrenos.avisadas.includes(leccion.id);
  const [avisando, setAvisando] = useState(false);
  const avisar = async () => {
    if (!confirm(`¿Mandar el correo “Ya salió: ${leccion.titulo}” a los alumnos del curso (${estrenos.alumnos})? Sólo se puede una vez por lección.`)) return;
    setAvisando(true);
    try {
      const r = await api<{ enviados: number }>("/api/admin/cursos/lecciones/avisar", "POST", { id: leccion.id });
      toast(`Estreno avisado a ${r.enviados} alumno${r.enviados === 1 ? "" : "s"}`);
      onChanged();
    } catch (e) { toast(errorDe(e)); }
    finally { setAvisando(false); }
  };

  const publicar = () => {
    if (!leccion.publicada && sinArchivo && !confirm("Esta lección todavía no tiene archivo. ¿Publicarla de todos modos?")) return;
    patch({ publicada: !leccion.publicada });
  };

  return (
    <div className={editando ? "my-1" : ""}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1 min-w-0">
        {puedeMover && (
          <div className="flex flex-col shrink-0">
            <button onClick={() => onMover(-1)} disabled={esPrimero} aria-label="Subir" className="text-white/30 hover:text-white disabled:opacity-15 cursor-pointer"><ChevronUp size={11} /></button>
            <button onClick={() => onMover(1)} disabled={esUltimo} aria-label="Bajar" className="text-white/30 hover:text-white disabled:opacity-15 cursor-pointer"><ChevronDown size={11} /></button>
          </div>
        )}
        <span title={et.desc} className="shrink-0 text-sm w-5 text-center" aria-label={et.label}>{et.emoji}</span>
        <button onClick={() => setEditando((v) => !v)} className="flex-1 min-w-[10rem] text-left text-sm text-white/85 truncate hover:text-white cursor-pointer">
          {leccion.titulo}
        </button>
        <span className="hidden lg:inline shrink-0 text-[11px] text-white/40">{TIPO_LABEL[leccion.tipo]}</span>
        {pendientes > 0 && <span className="hidden lg:inline shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-white/40">{pendientes} por escribir</span>}
        {sinArchivo && <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300">sin archivo</span>}
        <select value={leccion.estadoProduccion} onChange={(e) => patch({ estado_produccion: e.target.value })}
          aria-label="Estado de grabación"
          className={`shrink-0 text-[11px] rounded-full px-2 py-0.5 border-0 cursor-pointer focus:outline-none ${COLOR_ESTADO[leccion.estadoProduccion]}`}>
          {ESTADOS_PRODUCCION.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
        <button onClick={publicar}
          className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full cursor-pointer ${leccion.publicada ? "bg-green-500/15 text-green-400" : "bg-white/8 text-white/40 hover:text-white"}`}>
          {leccion.publicada ? "Publicada" : "Publicar"}
        </button>
        {leccion.publicada && estrenos.habilitado && (avisada ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-white/40" title="Ya se mandó el correo de estreno"><Megaphone size={11} /> Avisada</span>
        ) : (
          <button onClick={avisar} disabled={avisando} title="Mandar correo de estreno a los alumnos"
            className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-white/60 hover:text-white disabled:opacity-50 cursor-pointer">
            <Megaphone size={11} /> Avisar estreno
          </button>
        ))}
        <Link href={`/admin/cursos/${cursoId}/grabar/${leccion.id}`} aria-label="Modo grabación" title="Modo grabación"
          className="shrink-0 text-white/30 hover:text-white transition-colors"><Clapperboard size={13} /></Link>
        <button onClick={() => setEditando((v) => !v)} aria-label="Editar" className="shrink-0 text-white/30 hover:text-white transition-colors cursor-pointer"><Pencil size={13} /></button>
        <button onClick={borrar} aria-label="Borrar" className="shrink-0 text-white/30 hover:text-red-400 transition-colors cursor-pointer"><Trash2 size={13} /></button>
      </div>
      {editando && (
        <LeccionEditor
          leccion={leccion}
          modulos={modulos}
          onSaved={() => { setEditando(false); onChanged(); }}
          onCancel={() => setEditando(false)}
        />
      )}
    </div>
  );
}
