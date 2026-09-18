"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, X, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { FORMATOS_ENTREGA, MAX_ENTREGA_BYTES, NIVELES_RUBRICA, esFormatoEntrega } from "@/lib/cursos-tipos";
import type { EntregaAlumno } from "@/lib/curso-entregas";

interface Revisiones { incluidas: number; usadas: number; miembro: boolean }
type Rubrica = { criterio: string; niveles: string[] }[];

const tamano = (b: number | null) => (b == null ? "" : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`);
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

/**
 * Entrega de un reto o evaluación: primero se autoevalúa con la rúbrica (eso
 * entrena el criterio), luego sube su video directo a Drive con barra de
 * progreso. El servidor abre la sesión de subida; aquí nunca hay un token.
 */
export function EntregaReto({ cursoId, leccionId, rubrica }: { cursoId: string; leccionId: string; rubrica: Rubrica }) {
  const base = `/api/cuenta/curso/${cursoId}/leccion/${leccionId}/entrega`;
  const [entregas, setEntregas] = useState<EntregaAlumno[]>([]);
  const [rev, setRev] = useState<Revisiones | null>(null);
  const [auto, setAuto] = useState<Record<string, number>>({});
  const [comentario, setComentario] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Subir una entrega nueva sube la versión y vuelve a pedir la lista.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vivo = true;
    fetch(base)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!vivo || !data) return;
        setEntregas(data.entregas ?? []);
        setRev(data.revisiones ?? null);
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, [base, version]);

  const elegir = (f: File | null) => {
    setErr(null); setOk(null); setArchivo(null);
    if (!f) return;
    if (!esFormatoEntrega(f.name)) return setErr(`Formato no permitido. Sube ${Object.keys(FORMATOS_ENTREGA).join(", ")}.`);
    if (f.size > MAX_ENTREGA_BYTES) return setErr("Pesa más de 1 GB. Recórtalo o bájale la calidad.");
    setArchivo(f);
  };

  const enviar = async () => {
    if (!archivo) return;
    setErr(null); setOk(null); setProgreso(0);
    try {
      const s = await fetch(`${base}/sesion`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: archivo.name, bytes: archivo.size }),
      });
      const sesion = await s.json();
      if (!s.ok) throw new Error(sesion.error || "No se pudo preparar la subida.");

      const subido = await new Promise<{ id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", sesion.uploadUrl);
        xhr.setRequestHeader("Content-Type", sesion.mime || archivo.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
            else reject(new Error("Falló la subida."));
          } catch { reject(new Error("Falló la subida.")); }
        };
        xhr.onerror = () => reject(new Error("Se cortó la conexión."));
        xhr.onabort = () => reject(new Error("Cancelaste la subida."));
        xhr.send(archivo);
      });

      const c = await fetch(base, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drive_file_id: subido.id, autoevaluacion: auto, comentario }),
      });
      const conf = await c.json();
      if (!c.ok) throw new Error(conf.error || "No se pudo registrar tu entrega.");
      setOk(conf.conRevision ? "¡Listo! Te avisamos por correo cuando esté tu retroalimentación." : "¡Listo! Quedó guardada con tu autoevaluación.");
      setArchivo(null); setComentario(""); setAuto({});
      setVersion((v) => v + 1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo enviar.");
    } finally {
      setProgreso(null);
      xhrRef.current = null;
    }
  };

  const quedan = rev ? Math.max(0, rev.incluidas - rev.usadas) : 0;
  const acept = Object.keys(FORMATOS_ENTREGA).map((e) => `.${e}`).join(",");

  return (
    <div className="flex flex-col gap-5">
      {rev && (
        <p className="text-xs text-white/60">
          {rev.miembro ? "Como miembro de la mentoría, todas tus entregas llevan revisión." :
            quedan > 0 ? `Te queda${quedan === 1 ? "" : "n"} ${quedan} revisión${quedan === 1 ? "" : "es"} personal${quedan === 1 ? "" : "es"} incluida${quedan === 1 ? "" : "s"}.` :
            "Ya usaste tu revisión incluida: esta entrega queda con tu autoevaluación. En la mentoría revisamos todas."}
        </p>
      )}

      {rubrica.length > 0 && (
        <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <h3 className="font-coolvetica text-lg mb-1">Autoevalúate primero</h3>
          <p className="text-xs text-white/50 mb-3">Escúchate con honestidad. Luego compara con lo que te digamos: ahí está el aprendizaje.</p>
          <div className="flex flex-col gap-3">
            {rubrica.map((r) => (
              <div key={r.criterio}>
                <p className="text-sm mb-1.5">{r.criterio}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {NIVELES_RUBRICA.map((n, k) => (
                    <button key={n} onClick={() => setAuto({ ...auto, [r.criterio]: k + 1 })} title={r.niveles[k] || n}
                      aria-pressed={auto[r.criterio] === k + 1}
                      className={`rounded-lg px-2 py-1.5 text-xs text-left border cursor-pointer transition-colors ${auto[r.criterio] === k + 1 ? "border-lgb-red bg-lgb-red/10 text-white" : "border-white/10 text-white/60 hover:border-white/25"}`}>
                      <span className="block font-medium">{k + 1} · {n}</span>
                      {r.niveles[k] && <span className="block text-[11px] text-white/50 mt-0.5">{r.niveles[k]}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <label className="block">
          <span className="block text-[11px] font-medium text-white/55 mb-1.5">Algo que quieras que revisemos (opcional)</span>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={2000}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-lgb-red resize-none" />
        </label>

        {progreso != null ? (
          <div className="rounded-2xl border border-white/10 p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="flex items-center gap-2"><Loader2 size={15} className="animate-spin text-lgb-red" /> Subiendo… {progreso}%</span>
              <button onClick={() => xhrRef.current?.abort()} className="text-white/50 hover:text-white text-xs flex items-center gap-1 cursor-pointer"><X size={13} /> Cancelar</button>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-lgb-red transition-all" style={{ width: `${progreso}%` }} /></div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1 flex items-center gap-2 rounded-xl border-2 border-dashed border-white/15 hover:border-lgb-red/50 px-4 py-3 cursor-pointer text-sm text-white/60">
              <Upload size={16} className="shrink-0" />
              <span className="truncate">{archivo ? `${archivo.name} · ${tamano(archivo.size)}` : "Elige tu video o audio"}</span>
              <input type="file" accept={acept} className="hidden" onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
            </label>
            <button onClick={enviar} disabled={!archivo}
              className="shrink-0 bg-lgb-red text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 cursor-pointer">
              Enviar entrega
            </button>
          </div>
        )}
        {err && <p className="flex items-center gap-1.5 text-sm text-red-400"><AlertCircle size={14} /> {err}</p>}
        {ok && <p className="flex items-center gap-1.5 text-sm text-green-400"><CheckCircle2 size={14} /> {ok}</p>}
      </section>

      {entregas.length > 0 && (
        <section>
          <h3 className="font-coolvetica text-lg mb-2">Tus entregas</h3>
          <div className="flex flex-col gap-2">
            {entregas.map((e) => (
              <article key={e.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="text-sm flex-1 min-w-0 truncate">{e.nombre}</p>
                  <span className="text-[11px] text-white/40">{fecha(e.createdAt)}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 ${e.estado === "revisada" ? "bg-green-500/15 text-green-400" : "bg-white/8 text-white/60"}`}>
                    {e.estado === "revisada" ? <><CheckCircle2 size={11} /> Revisada</> : e.conRevision ? <><Clock size={11} /> En revisión</> : "Autoevaluación"}
                  </span>
                </div>
                {Object.keys(e.autoevaluacion).length > 0 && (
                  <ul className="mt-2 text-xs text-white/60 flex flex-col gap-0.5">
                    {Object.entries(e.autoevaluacion).map(([k, v]) => (
                      <li key={k}>
                        {k}: tú {v}/4{e.rubricaProfe[k] ? <> · maestro <b className="text-white">{e.rubricaProfe[k]}/4</b></> : null}
                      </li>
                    ))}
                  </ul>
                )}
                {e.retro && <p className="mt-3 text-sm text-white/85 leading-relaxed whitespace-pre-line border-l-2 border-lgb-red pl-3">{e.retro}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
