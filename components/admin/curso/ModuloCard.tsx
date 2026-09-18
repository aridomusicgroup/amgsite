"use client";
import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { CursoModulo, CursoLeccion } from "@/lib/cursos-admin";
import { RUTAS, TIPOS_LECCION, TIPO_LABEL, ETIQUETAS, type Etiqueta, type Ruta, type TipoLeccion } from "@/lib/cursos-tipos";
import { inp } from "@/components/admin/tareas/estilos";
import { toast } from "@/lib/toast";
import { api, errorDe } from "./api";
import { LeccionRow } from "./LeccionRow";

/** Reordena mandando el arreglo completo de ids en su nuevo orden. */
function intercambiar(ids: string[], id: string, dir: -1 | 1): string[] | null {
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const copia = [...ids];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export function ModuloCard({ cursoId, modulo, modulos, visibles, filtrando, esPrimero, esUltimo, onChanged }: {
  cursoId: string;
  modulo: CursoModulo;
  modulos: CursoModulo[];
  visibles: CursoLeccion[];
  filtrando: boolean;
  esPrimero: boolean;
  esUltimo: boolean;
  onChanged: () => void;
}) {
  const [titulo, setTitulo] = useState(modulo.titulo);
  const [descripcion, setDescripcion] = useState(modulo.descripcion ?? "");
  const [agregando, setAgregando] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    try { await api("/api/admin/cursos/modulos", "PATCH", { id: modulo.id, ...body }); onChanged(); }
    catch (e) { toast(errorDe(e)); }
  };

  const guardarTitulo = () => {
    const v = titulo.trim();
    if (!v || v === modulo.titulo) { setTitulo(modulo.titulo); return; }
    patch({ titulo: v });
  };

  const borrar = async () => {
    if (!confirm(`¿Borrar el módulo "${modulo.titulo}" y todas sus lecciones? No se puede deshacer.`)) return;
    try { await api("/api/admin/cursos/modulos", "DELETE", { id: modulo.id }); onChanged(); }
    catch (e) { toast(errorDe(e)); }
  };

  const mover = async (dir: -1 | 1) => {
    const orden = intercambiar(modulos.map((m) => m.id), modulo.id, dir);
    if (!orden) return;
    try { await api("/api/admin/cursos/modulos", "PATCH", { orden_ids: orden }); onChanged(); }
    catch (e) { toast(errorDe(e)); }
  };

  const moverLeccion = async (leccionId: string, dir: -1 | 1) => {
    const orden = intercambiar(modulo.lecciones.map((l) => l.id), leccionId, dir);
    if (!orden) return;
    try { await api("/api/admin/cursos/lecciones", "PATCH", { orden_ids: orden }); onChanged(); }
    catch (e) { toast(errorDe(e)); }
  };

  if (filtrando && !visibles.length) return null;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex flex-col shrink-0">
          <button onClick={() => mover(-1)} disabled={esPrimero} aria-label="Subir módulo" className="text-white/40 hover:text-white disabled:opacity-20 cursor-pointer"><ChevronUp size={14} /></button>
          <button onClick={() => mover(1)} disabled={esUltimo} aria-label="Bajar módulo" className="text-white/40 hover:text-white disabled:opacity-20 cursor-pointer"><ChevronDown size={14} /></button>
        </div>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={guardarTitulo}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="flex-1 min-w-0 bg-transparent font-coolvetica text-lg focus:outline-none border-b border-transparent focus:border-white/20" />
        <select value={modulo.ruta} onChange={(e) => patch({ ruta: e.target.value as Ruta })}
          className="shrink-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none" aria-label="Ruta del módulo">
          {RUTAS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button onClick={borrar} aria-label="Borrar módulo" className="text-white/30 hover:text-red-400 transition-colors cursor-pointer shrink-0"><Trash2 size={15} /></button>
      </div>
      <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción corta del módulo (la ve el alumno)"
        onBlur={() => descripcion !== (modulo.descripcion ?? "") && patch({ descripcion: descripcion || null })}
        className="w-full ml-6 mb-3 bg-transparent text-xs text-white/50 focus:outline-none border-b border-transparent focus:border-white/20 max-w-[calc(100%-1.5rem)]" />

      <div className="flex flex-col gap-1 pl-6">
        {visibles.map((l) => (
          <LeccionRow
            key={l.id}
            cursoId={cursoId}
            leccion={l}
            modulos={modulos}
            puedeMover={!filtrando}
            esPrimero={l.id === modulo.lecciones[0]?.id}
            esUltimo={l.id === modulo.lecciones.at(-1)?.id}
            onMover={(dir) => moverLeccion(l.id, dir)}
            onChanged={onChanged}
          />
        ))}
        {modulo.lecciones.length === 0 && <p className="text-white/30 text-xs py-1">Sin lecciones todavía.</p>}
      </div>

      {agregando ? (
        <NuevaLeccion moduloId={modulo.id} onCreated={() => { setAgregando(false); onChanged(); }} onCancel={() => setAgregando(false)} />
      ) : (
        <button onClick={() => setAgregando(true)}
          className="mt-2 ml-6 flex items-center gap-1.5 text-white/50 hover:text-white text-xs transition-colors cursor-pointer">
          <Plus size={13} /> Agregar lección
        </button>
      )}
    </div>
  );
}

function NuevaLeccion({ moduloId, onCreated, onCancel }: { moduloId: string; onCreated: () => void; onCancel: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TipoLeccion>("video");
  const [etiqueta, setEtiqueta] = useState<Etiqueta>("nucleo");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const crear = async () => {
    if (!titulo.trim()) { setErr("Ponle un título."); return; }
    setBusy(true); setErr(null);
    try {
      await api("/api/admin/cursos/lecciones", "POST", { modulo_id: moduloId, titulo, tipo, etiqueta, publicada: false });
      onCreated();
    } catch (e) { setErr(errorDe(e, "Error al crear")); setBusy(false); }
  };

  return (
    <div className="mt-2 ml-6 rounded-xl bg-white/5 border border-white/10 p-3 flex flex-col gap-2">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la lección" autoFocus className={inp}
        onKeyDown={(e) => e.key === "Enter" && crear()} />
      <div className="grid grid-cols-2 gap-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoLeccion)} className={inp} aria-label="Tipo">
          {TIPOS_LECCION.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </select>
        <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value as Etiqueta)} className={inp} aria-label="Etiqueta">
          {ETIQUETAS.map((e) => <option key={e.id} value={e.id}>{e.emoji} {e.label}</option>)}
        </select>
      </div>
      <p className="text-white/40 text-[11px]">Nace sin publicar: el guion y el archivo se completan al editarla.</p>
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex gap-2">
        <button onClick={crear} disabled={busy} className="bg-lgb-red text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer">
          {busy ? "Creando…" : "Agregar"}
        </button>
        <button onClick={onCancel} className="text-white/50 hover:text-white text-xs px-3 py-1.5 cursor-pointer">Cancelar</button>
      </div>
    </div>
  );
}

export function NuevoModulo({ cursoId, onCreated }: { cursoId: string; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [busy, setBusy] = useState(false);

  const crear = async () => {
    if (!titulo.trim()) return;
    setBusy(true);
    try {
      await api("/api/admin/cursos/modulos", "POST", { curso_id: cursoId, titulo });
      setTitulo("");
      onCreated();
    } catch (e) { toast(errorDe(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-4 flex gap-2">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nombre del módulo nuevo"
        onKeyDown={(e) => e.key === "Enter" && crear()} className={inp} />
      <button onClick={crear} disabled={busy || !titulo.trim()}
        className="shrink-0 flex items-center gap-1.5 bg-white/10 text-white px-3.5 py-2 rounded-xl text-sm hover:bg-white/15 transition-colors disabled:opacity-40 cursor-pointer">
        <Plus size={15} /> Módulo
      </button>
    </div>
  );
}
