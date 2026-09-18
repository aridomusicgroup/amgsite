"use client";
import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Save, Inbox, UsersRound, ExternalLink, ChevronDown } from "lucide-react";
import type { CursoDetalle } from "@/lib/cursos-admin";
import { CAMPOS_LANDING, CTA_TEXTO_DEFAULT, esRellenar, indicacion, type Cta, type EstadoMentoria } from "@/lib/cursos-tipos";
import { inp, lblS } from "@/components/admin/tareas/estilos";
import { DOMAINS } from "@/lib/site";
import { api, errorDe } from "./api";

const ESTADOS_MENTORIA: { id: EstadoMentoria; label: string; ayuda: string }[] = [
  { id: "oculta", label: "Apagada", ayuda: "Los llamados a la mentoría no se muestran." },
  { id: "lista_espera", label: "Lista de espera", ayuda: "El alumno se anota con un clic; tú ves cuántos quieren." },
  { id: "abierta", label: "Abierta", ayuda: "El alumno puede pagar su mes desde el curso." },
];

/** Datos del curso, interruptor de la mentoría y textos de los llamados y de la página de venta. */
export function CabeceraCurso({ curso, servicioEmail, onSaved }: { curso: CursoDetalle; servicioEmail: string | null; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(curso.titulo);
  const [descripcion, setDescripcion] = useState(curso.descripcion ?? "");
  const [precio, setPrecio] = useState(curso.precioMxn?.toString() ?? "");
  const [driveFolder, setDriveFolder] = useState(curso.driveFolderId ?? "");
  const [revisiones, setRevisiones] = useState(String(curso.revisionesIncluidas));
  const [mentoria, setMentoria] = useState(curso.config.mentoria);
  const [meta, setMeta] = useState(String(curso.config.meta_semanal_min));
  const [textos, setTextos] = useState(curso.config.cta_textos);
  const [verTextos, setVerTextos] = useState(false);
  const [landing, setLanding] = useState(() => Object.fromEntries(
    CAMPOS_LANDING.map((c) => [c.key, esRellenar(curso.config.landing[c.key]) ? "" : curso.config.landing[c.key]]),
  ) as Record<string, string>);
  const [verLanding, setVerLanding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const esCurso = curso.tipo === "curso";

  const guardar = async () => {
    setBusy(true); setErr(null);
    try {
      await api("/api/admin/cursos", "PATCH", {
        id: curso.id, titulo, descripcion: descripcion || null,
        precio_mxn: precio || null, drive_folder: driveFolder || null,
        revisiones_incluidas: Number(revisiones) || 0,
        config: {
          ...curso.config, mentoria, meta_semanal_min: Number(meta) || 150, cta_textos: textos,
          // Lo vacío conserva la indicación de la plantilla (y no se muestra en la página).
          landing: Object.fromEntries(CAMPOS_LANDING.map((c) => [c.key, landing[c.key]?.trim() ? landing[c.key] : curso.config.landing[c.key]])),
        },
      });
      onSaved();
    } catch (e) { setErr(errorDe(e, "Error al guardar")); }
    finally { setBusy(false); }
  };

  const toggleActivo = async () => {
    try { await api("/api/admin/cursos", "PATCH", { id: curso.id, activo: !curso.activo }); onSaved(); }
    catch (e) { setErr(errorDe(e)); }
  };

  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-white/40 text-xs">
          /{curso.slug} · {esCurso ? "Curso" : "Mentoría"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {esCurso && curso.activo && (
            <a href={`${DOMAINS.main}/cursos/${curso.slug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/8 text-white/60 hover:text-white">
              <ExternalLink size={13} /> Página de venta
            </a>
          )}
          <Link href={`/admin/cursos/entregas?curso=${curso.id}`} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/8 text-white/60 hover:text-white">
            <Inbox size={13} /> Entregas{curso.entregasPendientes ? ` · ${curso.entregasPendientes} por revisar` : ""}
          </Link>
          {curso.interesados > 0 && (
            <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/8 text-white/60">
              <UsersRound size={13} /> {curso.interesados} quieren mentoría
            </span>
          )}
          <button onClick={toggleActivo}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer ${curso.activo ? "bg-green-500/15 text-green-400" : "bg-white/10 text-white/50"}`}>
            {curso.activo ? <Eye size={13} /> : <EyeOff size={13} />}
            {curso.activo ? "Visible a clientes" : "Oculto"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={lblS}>Título</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inp} />
        </label>
        <label className="block sm:col-span-2">
          <span className={lblS}>Descripción (también sale en la página de venta)</span>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={`${inp} resize-none`} />
        </label>
        <label className="block">
          <span className={lblS}>Precio MXN</span>
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} type="number" min="0" className={inp} placeholder="Sin precio = no se vende en línea" />
        </label>
        <label className="block">
          <span className={lblS}>Carpeta de Drive (link o ID)</span>
          <input value={driveFolder} onChange={(e) => setDriveFolder(e.target.value)} placeholder="https://drive.google.com/drive/folders/..." className={inp} />
        </label>
        {esCurso && (
          <>
            <label className="block">
              <span className={lblS}>Revisiones personales incluidas</span>
              <input value={revisiones} onChange={(e) => setRevisiones(e.target.value)} type="number" min="0" max="20" className={inp} />
            </label>
            <label className="block">
              <span className={lblS}>Meta semanal de práctica (min)</span>
              <input value={meta} onChange={(e) => setMeta(e.target.value)} type="number" min="10" className={inp} />
            </label>
          </>
        )}
      </div>

      {esCurso && (
        <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-sm font-medium mb-1">Mentoría grupal</p>
          <p className="text-white/40 text-xs mb-3">{ESTADOS_MENTORIA.find((e) => e.id === mentoria.estado)?.ayuda}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={lblS}>Estado</span>
              <select value={mentoria.estado} onChange={(e) => setMentoria({ ...mentoria, estado: e.target.value as EstadoMentoria })} className={inp}>
                {ESTADOS_MENTORIA.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={lblS}>Curso de la mentoría</span>
              <select value={mentoria.curso_id ?? ""} onChange={(e) => setMentoria({ ...mentoria, curso_id: e.target.value || null })} className={inp}>
                <option value="">— Ninguno —</option>
                {curso.mentorias.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={lblS}>Precio por mes (MXN)</span>
              <input value={mentoria.precio_mes ?? ""} type="number" min="0"
                onChange={(e) => setMentoria({ ...mentoria, precio_mes: e.target.value ? Number(e.target.value) : null })} className={inp} />
            </label>
          </div>
          <button onClick={() => setVerTextos((v) => !v)} className="mt-3 flex items-center gap-1 text-xs text-white/50 hover:text-white cursor-pointer">
            <ChevronDown size={13} className={verTextos ? "rotate-180" : ""} /> Textos de los llamados
          </button>
          {verTextos && (
            <div className="mt-2 grid gap-2">
              {(Object.keys(CTA_TEXTO_DEFAULT) as Exclude<Cta, "ninguno">[]).map((k) => (
                <label key={k} className="block">
                  <span className={lblS}>{k === "revision" ? "Revisión" : k === "mentoria" ? "Mentoría" : k === "estudio" ? "Estudio" : "WhatsApp"}</span>
                  <textarea rows={2} value={textos[k] ?? ""} placeholder={CTA_TEXTO_DEFAULT[k]}
                    onChange={(e) => setTextos({ ...textos, [k]: e.target.value })} className={`${inp} resize-none`} />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {esCurso && (
        <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <button onClick={() => setVerLanding((v) => !v)} className="flex items-center gap-1 text-sm font-medium cursor-pointer">
            <ChevronDown size={14} className={verLanding ? "rotate-180" : ""} /> Página de venta
          </button>
          <p className="text-white/40 text-xs mt-1">Lo que dejes vacío no aparece en la página. El mapa del curso y lo que incluye salen solos del contenido.</p>
          {verLanding && (
            <div className="mt-3 grid gap-3">
              {CAMPOS_LANDING.map((c) => (
                <label key={c.key} className="block">
                  <span className={lblS}>{c.label}</span>
                  <textarea rows={c.key === "faqs" ? 8 : c.key === "promesa" ? 2 : 4} value={landing[c.key] ?? ""}
                    placeholder={indicacion(curso.config.landing[c.key]) || c.ayuda}
                    onChange={(e) => setLanding({ ...landing, [c.key]: e.target.value })} className={`${inp} resize-y`} />
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {servicioEmail && (
        <p className="mt-3 text-[11px] text-white/40 leading-relaxed">
          Para que los videos, PDFs y tablaturas se puedan reproducir, comparte la carpeta de Drive de este curso (lector) con{" "}
          <code className="text-white/60">{servicioEmail}</code>, igual que las carpetas de beats.
        </p>
      )}

      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <button onClick={guardar} disabled={busy}
        className="mt-4 flex items-center gap-2 bg-lgb-red text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-40 cursor-pointer">
        <Save size={15} /> {busy ? "Guardando…" : "Guardar"}
      </button>
    </section>
  );
}
