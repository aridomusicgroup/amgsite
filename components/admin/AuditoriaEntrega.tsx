"use client";
import { useState } from "react";
import { ShieldCheck, Loader2, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Link2, Check, X } from "lucide-react";
import { FORMATOS, evaluar, resumir, type BeatAuditado, type ResumenAuditoria, type Formato } from "@/lib/beats-auditoria";

const ESTADO: Record<string, { texto: string; color: string }> = {
  completo: { texto: "completo", color: "bg-green-500/15 text-green-300" },
  parcial: { texto: "incompleto", color: "bg-amber-500/15 text-amber-300" },
  vacio: { texto: "carpeta vacía", color: "bg-red-500/20 text-red-300" },
  sin_carpeta: { texto: "sin carpeta", color: "bg-red-500/20 text-red-300" },
};

const urlCarpeta = (id: string) => `https://drive.google.com/drive/folders/${id}`;

/**
 * Auditoría de entregabilidad: qué beats se pueden entregar HOY.
 *
 * Se corre a mano (no en cada carga) porque cada pasada son ~20 llamadas a
 * Google Drive; dispararlas cada vez que alguien abre el catálogo sería gastar
 * cuota para nada.
 */
export function AuditoriaEntrega() {
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<{ resumen: ResumenAuditoria; beats: BeatAuditado[]; cuentaServicio: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  const correr = async () => {
    setCargando(true); setError(null);
    try {
      const r = await fetch("/api/admin/beats/auditoria", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "No se pudo auditar."); return; }
      setRes({ resumen: d.resumen, beats: d.beats, cuentaServicio: d.cuentaServicio ?? null });
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  // Reemplaza UN beat tras asignarle carpeta, sin volver a auditar los 55.
  // Se recalcula con la misma función que usa el servidor para que el renglón
  // y el resumen no puedan terminar contando cosas distintas.
  const actualizarBeat = (
    id: string,
    folderId: string,
    archivos: Partial<Record<Formato, number>>,
    sueltos: number,
  ) => {
    setRes((prev) => {
      if (!prev) return prev;
      const beats = prev.beats.map((b) =>
        b.id !== id
          ? b
          : evaluar(
              { id: b.id, title: b.title, origen: b.origen, tieneCarpeta: true, carpetaId: folderId, manual: true },
              archivos,
              sueltos,
            ),
      );
      return { ...prev, beats, resumen: resumir(beats) };
    });
  };

  const problemas = res?.beats.filter((b) => b.estado !== "completo") ?? [];
  const lista = verTodos ? res?.beats ?? [] : problemas;

  return (
    <div className="mt-8 border-t border-white/8 pt-6">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h2 className="text-sm font-medium text-white/80">¿Se puede entregar lo que vendes?</h2>
        <button onClick={correr} disabled={cargando}
          className="ml-auto flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer">
          {cargando ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
          {cargando ? "Revisando Drive…" : "Auditar catálogo"}
        </button>
      </div>
      <p className="text-white/35 text-[11px] mb-3">
        Revisa en Drive que cada beat tenga su carpeta y <b>archivos adentro</b> de MP3, WAV y STEMS.
        Solo lee: no mueve ni borra nada.
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {res && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <Tarjeta n={res.resumen.completos} label="completos" bien />
            <Tarjeta n={res.resumen.parciales} label="incompletos" alerta={res.resumen.parciales > 0} />
            <Tarjeta n={res.resumen.vacios} label="carpeta vacía" grave={res.resumen.vacios > 0} />
            <Tarjeta n={res.resumen.sinCarpeta} label="sin carpeta" grave={res.resumen.sinCarpeta > 0} />
          </div>

          {res.resumen.niLaBasica > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-3 py-2.5 mb-3">
              <AlertTriangle size={15} className="text-red-300 shrink-0 mt-0.5" />
              <p className="text-xs text-white/70 leading-relaxed">
                <b className="text-red-200">{res.resumen.niLaBasica} beats no pueden entregar ni la licencia básica.</b>{" "}
                Se venden en la tienda y el cliente pagaría sin recibir archivos.
                {res.resumen.sinStems > res.resumen.niLaBasica && (
                  <> Otros <b className="text-amber-200">{res.resumen.sinStems - res.resumen.niLaBasica}</b> no
                  pueden cumplir Premium Plus ni Exclusiva (les faltan STEMS o WAV).</>
                )}
              </p>
            </div>
          )}

          {/* Casi siempre la carpeta "vacía" no está vacía: es la carpeta equivocada
              o nunca se compartió. Se dice aquí para no volver a investigarlo. */}
          {(res.resumen.vacios > 0 || res.resumen.sinCarpeta > 0) && (
            <p className="text-white/45 text-[11px] leading-relaxed mb-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5">
              Si sabes que ese beat <b className="text-white/70">sí tiene sus archivos</b>, casi siempre es que está
              apuntando a la carpeta equivocada. Ábrela con <ExternalLink size={11} className="inline -mt-0.5" /> para
              comprobarlo y corrige el link con <Link2 size={11} className="inline -mt-0.5" />.
              {res.cuentaServicio && (
                <> La otra causa es permisos: la carpeta debe estar compartida con{" "}
                <code className="text-white/70 bg-white/8 px-1 py-0.5 rounded">{res.cuentaServicio}</code>.</>
              )}
            </p>
          )}

          {problemas.length === 0 && (
            <p className="text-green-300 text-xs mb-3">🎉 Los {res.resumen.total} beats están completos: MP3, WAV y STEMS con archivos.</p>
          )}

          <ul className="space-y-1.5">
            {lista.map((b) => (
              <li key={b.id} className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-white/80 truncate max-w-[min(100%,22rem)]">{b.title || b.id}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${ESTADO[b.estado].color}`}>
                    {ESTADO[b.estado].texto}
                  </span>
                  {b.origen === "agregado" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lgb-red/20 text-lgb-red">agregado</span>
                  )}
                  {b.manual && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">link a mano</span>
                  )}
                  {b.carpetaId && (
                    <a href={urlCarpeta(b.carpetaId)} target="_blank" rel="noopener noreferrer"
                      title="Abrir en Drive la carpeta que el sistema está mirando"
                      className="ml-auto text-white/40 hover:text-white cursor-pointer">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2.5 mt-1 flex-wrap text-[11px]">
                  {FORMATOS.map((f) => {
                    const n = b.archivos[f];
                    const color = n === undefined ? "text-white/25" : n === 0 ? "text-red-300" : "text-green-300/80";
                    const txt = n === undefined ? "no existe" : n === 0 ? "vacía" : `${n} archivo${n === 1 ? "" : "s"}`;
                    return <span key={f} className={color}>{f}: {txt}</span>;
                  })}
                  {b.sueltos > 0 && <span className="text-white/35">· {b.sueltos} sueltos en la raíz</span>}
                </div>
                {b.noPuedeEntregar.length > 0 && (
                  <p className="text-[11px] text-amber-300/70 mt-1">
                    No puede entregar: {b.noPuedeEntregar.join(" · ")}
                  </p>
                )}
                <EditorCarpeta beat={b} onGuardado={actualizarBeat} />
              </li>
            ))}
          </ul>

          {problemas.length > 0 && (
            <button onClick={() => setVerTodos((v) => !v)}
              className="flex items-center gap-1 text-white/40 hover:text-white text-[11px] mt-2 cursor-pointer">
              {verTodos ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {verTodos ? "Ver solo los que tienen problema" : `Ver los ${res.resumen.total} (incluidos los completos)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Asignar a mano la carpeta de Drive de un beat.
 *
 * Va en su propio componente por la misma razón que `FichaEditor`: con el texto
 * viviendo en la lista, cada tecla repinta los 55 renglones.
 */
function EditorCarpeta({
  beat,
  onGuardado,
}: {
  beat: BeatAuditado;
  onGuardado: (id: string, folderId: string, archivos: Partial<Record<Formato, number>>, sueltos: number) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [link, setLink] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cerrar = () => { setAbierto(false); setError(null); setAviso(null); };

  const guardar = async () => {
    if (!link.trim() || guardando) return;
    setGuardando(true); setError(null); setAviso(null);
    try {
      const r = await fetch("/api/admin/beats/carpeta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: beat.id, link }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "No se pudo guardar."); return; }
      onGuardado(beat.id, d.folderId, d.archivos ?? {}, d.sueltos ?? 0);
      setLink("");
      // Si quedó bien se cierra solo; si algo sigue faltando el aviso se queda
      // a la vista para que no se dé por resuelto sin serlo.
      if (d.aviso) setAviso(d.aviso);
      else setAbierto(false);
    } catch {
      setError("Error de conexión.");
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)}
        className="flex items-center gap-1 text-white/40 hover:text-white text-[11px] mt-1.5 cursor-pointer">
        <Link2 size={11} />
        {beat.carpetaId ? "Corregir el link de la carpeta" : "Asignar la carpeta de Drive"}
      </button>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
            if (e.key === "Escape") cerrar();
          }}
          placeholder="Pega el link de la carpeta de Drive"
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white placeholder:text-white/25 outline-none focus:border-white/25"
        />
        <button onClick={guardar} disabled={guardando || !link.trim()}
          title="Guardar y comprobar"
          className="text-green-300/80 hover:text-green-300 disabled:opacity-30 cursor-pointer p-1">
          {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
        </button>
        <button onClick={cerrar} title="Cancelar" className="text-white/40 hover:text-white cursor-pointer p-1">
          <X size={14} />
        </button>
      </div>
      {error && <p className="text-red-300 text-[11px] mt-1.5 leading-relaxed">{error}</p>}
      {aviso && <p className="text-amber-300/80 text-[11px] mt-1.5 leading-relaxed">{aviso}</p>}
    </div>
  );
}

function Tarjeta({ n, label, bien, alerta, grave }: { n: number; label: string; bien?: boolean; alerta?: boolean; grave?: boolean }) {
  const color = grave ? "text-red-300" : alerta ? "text-amber-300" : bien ? "text-green-300" : "text-white";
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2">
      <p className={`font-coolvetica text-xl leading-none ${color}`}>{n}</p>
      <p className="text-white/40 text-[10px] mt-1">{label}</p>
    </div>
  );
}
