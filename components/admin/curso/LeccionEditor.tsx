"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { CursoLeccion, CursoModulo } from "@/lib/cursos-admin";
import {
  CTAS, ETIQUETAS, TIPOS_LECCION, TIPO_LABEL, TIPOS_CON_ARCHIVO, esRellenar, formatoTiempo, aSegundos,
  marcadoresATexto, parseMarcadores, validarDiagnostico, validarQuiz, validarRubrica,
  type Cta, type Etiqueta, type Recurso, type TipoLeccion, type TipoRecurso,
} from "@/lib/cursos-tipos";
import { inp, lblS } from "@/components/admin/tareas/estilos";
import { api, errorDe } from "./api";
import { GuionTab, clavesGuion, textosAContenido, textosIniciales } from "./GuionTab";
import { QuizEditor, RubricaEditor } from "./QuizEditor";

type Tab = "datos" | "guion" | "capitulos" | "recursos" | "quiz" | "rubrica";

const TIPOS_RECURSO: { id: TipoRecurso; label: string }[] = [
  { id: "pdf", label: "PDF" }, { id: "audio", label: "Audio / pista" }, { id: "gp", label: "Guitar Pro" }, { id: "otro", label: "Otro" },
];

/** ISO → valor de <input type="datetime-local"> en la hora de este navegador. */
const aLocal = (iso: unknown): string => {
  if (typeof iso !== "string" || Number.isNaN(Date.parse(iso))) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** Todo lo editable de una lección, en pestañas; se guarda de una vez. */
export function LeccionEditor({ leccion, modulos, onSaved, onCancel }: {
  leccion: CursoLeccion; modulos: CursoModulo[]; onSaved: () => void; onCancel: () => void;
}) {
  const c = leccion.contenido;
  const moduloActual = modulos.find((m) => m.lecciones.some((l) => l.id === leccion.id))?.id ?? "";

  const [tab, setTab] = useState<Tab>("datos");
  const [titulo, setTitulo] = useState(leccion.titulo);
  const [tipo, setTipo] = useState<TipoLeccion>(leccion.tipo);
  const [etiqueta, setEtiqueta] = useState<Etiqueta>(leccion.etiqueta);
  const [moduloId, setModuloId] = useState(moduloActual);
  const [opcional, setOpcional] = useState(leccion.opcional);
  const [preview, setPreview] = useState(leccion.preview);
  const [cta, setCta] = useState<Cta>(leccion.cta);
  const [driveLink, setDriveLink] = useState(leccion.driveFileId ?? "");
  const [urlExterna, setUrlExterna] = useState(leccion.urlExterna ?? "");
  const [duracion, setDuracion] = useState(leccion.duracionSeg ? formatoTiempo(leccion.duracionSeg) : "");
  const [fechaHora, setFechaHora] = useState(aLocal(c.fecha_hora));
  const [duracionMin, setDuracionMin] = useState(c.duracion_min ? String(c.duracion_min) : "");
  const [textos, setTextos] = useState(() => textosIniciales(c, clavesGuion(leccion.etiqueta, leccion.cta)));
  const [capitulos, setCapitulos] = useState(marcadoresATexto(leccion.marcadores));
  const [recursos, setRecursos] = useState<Recurso[]>(leccion.recursos);
  const [preguntas, setPreguntas] = useState(() => validarQuiz(c.preguntas));
  const diagOriginal = useMemo(() => validarDiagnostico(c.diagnostico), [c.diagnostico]);
  const [diagnostico, setDiagnostico] = useState(() => diagOriginal.map((r) => ({ ...r, texto: esRellenar(r.texto) ? "" : r.texto })));
  const rubricaOriginal = useMemo(() => validarRubrica(c.rubrica), [c.rubrica]);
  const [rubrica, setRubrica] = useState(() => rubricaOriginal.map((r) => ({ ...r, niveles: r.niveles.map((n) => (esRellenar(n) ? "" : n)) })));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const conArchivo = TIPOS_CON_ARCHIVO.includes(tipo);
  const tabs: { id: Tab; label: string }[] = [
    { id: "datos", label: "Datos" },
    ...(tipo !== "quiz" ? [{ id: "guion" as Tab, label: "Guion" }] : []),
    ...(tipo === "video" || tipo === "en_vivo" ? [{ id: "capitulos" as Tab, label: "Capítulos" }] : []),
    { id: "recursos", label: `Recursos${recursos.length ? ` (${recursos.length})` : ""}` },
    ...(tipo === "quiz" ? [{ id: "quiz" as Tab, label: "Quiz" }] : []),
    ...(tipo === "entrega" ? [{ id: "rubrica" as Tab, label: "Rúbrica" }] : []),
  ];
  const marcadores = parseMarcadores(capitulos);

  const guardar = async () => {
    if (!titulo.trim()) { setErr("Ponle un título."); setTab("datos"); return; }
    const seg = duracion.trim() ? aSegundos(duracion.trim()) ?? Number(duracion) : null;
    setBusy(true); setErr(null);
    try {
      const contenido: Record<string, unknown> = {
        ...c,
        ...textosAContenido(textos, c),
        preguntas,
        diagnostico: diagnostico.map((r, i) => ({ ...r, texto: r.texto.trim() || diagOriginal[i]?.texto || "" })),
        rubrica: rubrica.map((r, i) => ({ ...r, niveles: r.niveles.map((n, k) => n.trim() || rubricaOriginal[i]?.niveles[k] || "") })),
        ...(tipo === "en_vivo" ? { fecha_hora: fechaHora ? new Date(fechaHora).toISOString() : undefined, duracion_min: Number(duracionMin) || undefined } : {}),
      };
      await api("/api/admin/cursos/lecciones", "PATCH", {
        id: leccion.id, titulo, tipo, etiqueta, opcional, preview, cta,
        ...(moduloId && moduloId !== moduloActual ? { modulo_id: moduloId } : {}),
        drive_link: conArchivo ? driveLink || null : null,
        url_externa: tipo === "link" || tipo === "en_vivo" ? urlExterna || null : null,
        duracion_seg: seg && Number.isFinite(seg) ? seg : null,
        contenido,
        marcadores,
        recursos,
      });
      onSaved();
    } catch (e) { setErr(errorDe(e, "Error al guardar")); setBusy(false); }
  };

  return (
    <div className="my-2 rounded-xl bg-white/[0.04] border border-white/10 p-3">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer ${tab === t.id ? "bg-white/15 text-white" : "text-white/50 hover:text-white"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={onCancel} aria-label="Cerrar" className="text-white/40 hover:text-white cursor-pointer shrink-0"><X size={16} /></button>
      </div>

      {tab === "datos" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className={lblS}>Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inp} /></label>
          <label className="block"><span className={lblS}>Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoLeccion)} className={inp}>
              {TIPOS_LECCION.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select></label>
          <label className="block"><span className={lblS}>Etiqueta</span>
            <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value as Etiqueta)} className={inp}>
              {ETIQUETAS.map((e) => <option key={e.id} value={e.id}>{e.emoji} {e.label}</option>)}
            </select></label>
          <label className="block"><span className={lblS}>Módulo</span>
            <select value={moduloId} onChange={(e) => setModuloId(e.target.value)} className={inp}>
              {modulos.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select></label>
          <label className="block"><span className={lblS}>Llamado al final</span>
            <select value={cta} onChange={(e) => setCta(e.target.value as Cta)} className={inp}>
              {CTAS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select></label>
          {conArchivo && (
            <label className="block sm:col-span-2"><span className={lblS}>
              {tipo === "tab" ? "Archivo Guitar Pro / MusicXML en Drive (link o ID)" : tipo === "en_vivo" ? "Grabación de la sesión en Drive (después de la sesión)" : "Archivo en Drive (link o ID)"}
            </span>
              <input value={driveLink} onChange={(e) => setDriveLink(e.target.value)} placeholder="https://drive.google.com/file/d/..." className={inp} /></label>
          )}
          {(tipo === "link" || tipo === "en_vivo") && (
            <label className="block sm:col-span-2"><span className={lblS}>{tipo === "en_vivo" ? "Enlace de Meet / Zoom (sólo lo ven los miembros vigentes)" : "Enlace externo"}</span>
              <input value={urlExterna} onChange={(e) => setUrlExterna(e.target.value)} placeholder="https://" className={inp} /></label>
          )}
          {tipo === "en_vivo" && (
            <>
              <label className="block"><span className={lblS}>Fecha y hora</span>
                <input type="datetime-local" value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} className={inp} /></label>
              <label className="block"><span className={lblS}>Duración (min)</span>
                <input type="number" min={1} value={duracionMin} onChange={(e) => setDuracionMin(e.target.value)} className={inp} /></label>
            </>
          )}
          {(tipo === "video" || tipo === "en_vivo") && (
            <label className="block"><span className={lblS}>Duración del video (m:ss)</span>
              <input value={duracion} onChange={(e) => setDuracion(e.target.value)} placeholder="8:30" className={inp} /></label>
          )}
          <div className="flex flex-col gap-2 sm:col-span-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={opcional} onChange={(e) => setOpcional(e.target.checked)} className="accent-lgb-red" />
              Opcional (no cuenta para el avance ni el certificado)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} className="accent-lgb-red" />
              Vista previa gratis en la página de venta
            </label>
          </div>
        </div>
      )}

      {tab === "guion" && (
        <GuionTab etiqueta={etiqueta} cta={cta} original={c} textos={textos}
          onChange={(k, v) => setTextos((t) => ({ ...t, [k]: v }))} />
      )}

      {tab === "capitulos" && (
        <div>
          <span className={lblS}>Un capítulo por renglón: “0:45 Rasgueo base”</span>
          <textarea value={capitulos} onChange={(e) => setCapitulos(e.target.value)} rows={6} placeholder={"0:00 Gancho\n0:30 Lo mínimo\n3:10 Manos a la obra"} className={`${inp} font-mono`} />
          <p className="text-white/40 text-[11px] mt-1">{marcadores.length} capítulo{marcadores.length === 1 ? "" : "s"} reconocido{marcadores.length === 1 ? "" : "s"}</p>
        </div>
      )}

      {tab === "recursos" && (
        <div className="flex flex-col gap-2">
          <p className="text-white/40 text-[11px]">PDFs, pistas de acompañamiento, archivos Guitar Pro… El alumno los baja desde la lección; nunca ve el link de Drive.</p>
          {recursos.map((r, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto] items-center">
              <input value={r.titulo} onChange={(e) => setRecursos(recursos.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))} placeholder="Título (ej. Mapa del diapasón)" className={inp} />
              <input value={r.drive_file_id} onChange={(e) => setRecursos(recursos.map((x, j) => (j === i ? { ...x, drive_file_id: e.target.value } : x)))} placeholder="Link o ID de Drive" className={inp} />
              <select value={r.tipo} onChange={(e) => setRecursos(recursos.map((x, j) => (j === i ? { ...x, tipo: e.target.value as TipoRecurso } : x)))} className={inp}>
                {TIPOS_RECURSO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <button onClick={() => setRecursos(recursos.filter((_, j) => j !== i))} aria-label="Quitar recurso" className="text-white/30 hover:text-red-400 cursor-pointer"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => setRecursos([...recursos, { titulo: "", drive_file_id: "", tipo: "pdf" }])}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs cursor-pointer w-fit"><Plus size={13} /> Recurso</button>
        </div>
      )}

      {tab === "quiz" && (
        <QuizEditor preguntas={preguntas} diagnostico={diagnostico} diagOriginal={diagOriginal} recursos={recursos}
          onPreguntas={setPreguntas} onDiagnostico={setDiagnostico} />
      )}

      {tab === "rubrica" && <RubricaEditor rubrica={rubrica} original={rubricaOriginal} onChange={setRubrica} />}

      {err && <p className="text-red-400 text-xs mt-3">{err}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={guardar} disabled={busy} className="bg-lgb-red text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer">
          {busy ? "Guardando…" : "Guardar lección"}
        </button>
        <button onClick={onCancel} className="text-white/50 hover:text-white text-xs px-3 py-1.5 cursor-pointer">Cancelar</button>
      </div>
    </div>
  );
}
