"use client";
import { useRef, useState } from "react";
import { Loader2, Send, Upload, FolderOpen, Check, AlertTriangle, RotateCcw, FileMusic } from "lucide-react";
import { toast } from "@/lib/toast";

export interface Envio {
  id: string; num: number; estado: string; nota: string | null;
  notificar_a: string | null; notificar_email: string | null;
  compartido_con: string | null; creado_at: string; cerrado_at: string | null;
  updated_at: string; avisado_en: string | null; error: string | null;
}
export interface Revision {
  id: string; num: number; nombre: string; bytes: number | null; nota: string | null;
  subido_por: string | null; subido_at: string; bajado_at: string | null;
  ruta_local: string | null; ultimo_error: string | null;
}
export interface EstadoClave {
  envios: Envio[]; revisiones: Revision[];
  total: number; subidos: number; fallados: number; pendientes: number; bytesPendientes: number;
}

export const peso = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`);
const cuando = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const envioVivo = (e: EstadoClave) =>
  e.envios[0] && (e.envios[0].estado === "subiendo" || e.envios[0].estado === "abierto") ? e.envios[0] : null;

/**
 * Crea el envío (de un proyecto, un tema o varios temas) y dice cómo quedó.
 *
 * Mandar gigas y que nadie se entere es peor que no mandar: si nadie va a
 * recibir el aviso, el servidor lo rechaza y aquí se pregunta explícitamente.
 */
export async function mandarAEdicion(cuerpo: Record<string, unknown>): Promise<boolean> {
  const post = (extra: Record<string, unknown> = {}) => fetch("/api/admin/edicion", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...cuerpo, ...extra }),
  });
  try {
    let r = await post();
    let d = await r.json().catch(() => ({}));
    if (!r.ok && d.sinCorreo && confirm(`${d.error}\n\n¿Mandar de todos modos?`)) {
      r = await post({ forzar: true });
      d = await r.json().catch(() => ({}));
    }
    if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo"}`); return false; }
    toast(d.temas > 1
      ? `✓ ${d.temas} temas en fila: ${d.archivos} archivo(s). Suben uno tras otro en los próximos minutos.`
      : `✓ Envío ${d.envio}: ${d.archivos} archivo(s). Se suben en los próximos minutos.`);
    return true;
  } catch {
    toast("Error de red");
    return false;
  }
}

interface Props {
  proyectoId: string;
  /** La canción, si es un EP/álbum. null = beat personalizado. */
  tareaId: string | null;
  /** El nombre de la canción, para las preguntas. */
  titulo?: string | null;
  estado: EstadoClave;
  miId: string | null;
  recargar: () => Promise<void> | void;
  /** Cómo se manda, si quien contiene esto ya tiene su propia manera. En un
   *  álbum es la del renglón del tema, que pregunta si le falta algo: con dos
   *  caminos distintos, uno de los dos acabaría saltándose la pregunta. */
  onEnviar?: () => Promise<void>;
}

/**
 * Mandarle una carpeta a quien edita y cuantiza, y recibir sus revisiones.
 *
 * Una carpeta = una clave: el proyecto entero en un beat personalizado, o UNA
 * canción en un EP/álbum. El archivo NUNCA pasa por el navegador — lo sube el
 * script local directo a Google, porque una carpeta ronda el gigabyte.
 *
 * Es el mismo componente para los dos lados a propósito. Dos ramas de UI es el
 * principio de un desastre, y esconderle botones a un compañero no compra nada:
 * los tres roles del panel ya pueden todo aquí. Lo único que cambia según quién
 * mira es qué se ve primero.
 */
export function EdicionClave({ proyectoId, tareaId, titulo, estado: e, miId, recargar, onEnviar }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const vivo = e.envios[0];
  const soyQuienEdita = Boolean(miId && vivo?.notificar_a === miId);
  const conTema = tareaId ? { tarea_id: tareaId } : {};
  const qsTema = tareaId ? `&tarea_id=${tareaId}` : "";

  const enviar = async () => {
    if (onEnviar) {
      setBusy("enviar");
      try { await onEnviar(); } finally { setBusy(null); }
      return;
    }
    const nota = prompt("¿Algo que decirle? (opcional)\nEj: ya con las charchetas de Martín");
    if (nota === null) return;
    setBusy("enviar");
    try {
      if (await mandarAEdicion({ proyecto_id: proyectoId, ...conTema, nota })) await recargar();
    } finally { setBusy(null); }
  };

  const reintentar = async () => {
    setBusy("reintentar");
    try {
      const r = await fetch("/api/admin/edicion", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyecto_id: proyectoId, ...conTema }),
      });
      if (r.ok) { await recargar(); toast("✓ Se vuelven a intentar"); }
    } catch { toast("Error de red"); } finally { setBusy(null); }
  };

  const subirRevision = async (file: File) => {
    setBusy("revision");
    try {
      const tk = await fetch(`/api/admin/edicion?proyecto_id=${proyectoId}${qsTema}`, { method: "OPTIONS" });
      const d = await tk.json().catch(() => ({}));
      if (!tk.ok) { toast(`⚠️ ${d.error || "No se pudo preparar la subida"}`); return; }

      // Directo del navegador a Google, sin pasar por el servidor. Es 1 MB, así
      // que el multipart en memoria no es problema aquí.
      const meta = new Blob([JSON.stringify({ name: file.name, parents: [d.folderId] })], { type: "application/json" });
      const cuerpo = new FormData();
      cuerpo.append("metadata", meta);
      cuerpo.append("file", file);
      const up = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST", headers: { Authorization: `Bearer ${d.accessToken}` }, body: cuerpo,
      });
      const j = await up.json().catch(() => null);
      if (!up.ok || !j?.id) { toast("⚠️ Drive rechazó el archivo"); return; }

      const nota = prompt("¿Qué cambiaste? (opcional)\nEj: cuantizadas guitarras y bass") ?? "";
      // Lo decide quien edita, no la llegada del archivo: una revisión puede ser
      // un avance parcial. Cancelar = "todavía no", nunca bloquea el registro.
      const terminado = confirm(
        `¿Con esta revisión ya terminaste de editar ${titulo ? `“${titulo}”` : "este proyecto"}?\n\n` +
        "Aceptar = se palomea “Editar y cuantizar”.\nCancelar = es un avance, sigue abierta.",
      );
      const reg = await fetch("/api/admin/edicion", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyecto_id: proyectoId, ...conTema, nombre: file.name, drive_id: j.id, bytes: file.size, nota, terminado }),
      });
      const rj = await reg.json().catch(() => ({}));
      if (!reg.ok) { toast(`⚠️ ${rj.error || "Subió pero no se pudo registrar"}`); return; }
      await recargar();
      toast(`✓ Revisión ${rj.revision} subida${rj.palomeado ? ` · palomeado “${rj.palomeado}”` : ""} — se guarda en la compu en unos minutos`);
    } catch { toast("Error de red"); } finally { setBusy(null); }
  };

  const pctArchivos = e.total ? Math.round((e.subidos / e.total) * 100) : 0;

  const bloqueEnvio = (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] text-white/35 uppercase tracking-wider">
          {soyQuienEdita ? "Te toca editar" : "Envío a edición"}
        </p>
        <div className="flex items-center gap-1.5">
          {vivo?.compartido_con && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-white/30">
              <FolderOpen size={11} /> compartida con {vivo.compartido_con}
            </span>
          )}
          <button onClick={enviar} disabled={busy !== null || e.pendientes === 0 || Boolean(envioVivo(e))}
            title={e.pendientes === 0 ? "Nada nuevo desde el último envío" : `Subir ${e.pendientes} archivo(s) · ${peso(e.bytesPendientes)}`}
            className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              soyQuienEdita ? "bg-white/8 text-white/60 hover:bg-white/12" : "bg-lgb-red text-white hover:bg-red-700"}`}>
            {busy === "enviar" ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            {e.pendientes === 0 ? "Nada nuevo" : `Enviar lo que falta (${e.pendientes})`}
          </button>
        </div>
      </div>

      {e.envios.length === 0 && (
        <p className="text-[11px] text-white/25">Todavía no se ha mandado · {e.total} archivo(s) · {peso(e.bytesPendientes)}</p>
      )}

      {e.envios.map((v) => (
        <div key={v.id} className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 mb-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-white/75">Envío {v.num}</span>
            <span className="text-[11px] text-white/30">{cuando(v.creado_at)}</span>
          </div>
          {v.nota && <p className="text-[11px] text-white/40 italic mt-0.5">&ldquo;{v.nota}&rdquo;</p>}

          {(v.estado === "subiendo" || v.estado === "abierto") && (
            <div className="mt-1.5">
              <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                <div className="h-full bg-white/50 transition-all duration-700" style={{ width: `${pctArchivos}%` }} />
              </div>
              <p className="text-[11px] text-white/35 mt-1">
                {v.estado === "abierto" ? "en fila · " : ""}
                {e.subidos} de {e.total} archivos · faltan {peso(e.bytesPendientes)}
                {v.estado === "subiendo" && v.updated_at && <> · último hace {Math.round((Date.now() - new Date(v.updated_at).getTime()) / 60000)} min</>}
              </p>
            </div>
          )}
          {v.estado === "listo" && (
            <p className="flex items-center gap-1 text-[11px] text-green-300/70 mt-1">
              <Check size={11} /> completo
              {v.avisado_en ? ` · se le avisó a ${v.notificar_email}` : " · sin aviso"}
            </p>
          )}
          {v.estado === "error" && (
            <p className="flex items-center gap-1 text-[11px] text-red-300 mt-1"><AlertTriangle size={11} /> {v.error}</p>
          )}
        </div>
      ))}

      {e.fallados > 0 && (
        <button onClick={reintentar} disabled={busy !== null}
          className="flex items-center gap-1 text-[11px] text-amber-300/80 hover:text-amber-300 cursor-pointer">
          <RotateCcw size={11} /> {e.fallados} archivo(s) no subieron — reintentar
        </button>
      )}
    </div>
  );

  const bloqueRevisiones = (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] text-white/35 uppercase tracking-wider">Revisiones</p>
        <button onClick={() => fileRef.current?.click()} disabled={busy !== null}
          className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors disabled:opacity-40 ${
            soyQuienEdita ? "bg-lgb-red text-white hover:bg-red-700" : "bg-white/8 text-white/60 hover:bg-white/12"}`}>
          {busy === "revision" ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Subir revisión
        </button>
        <input ref={fileRef} type="file" accept=".rpp" className="hidden"
          onChange={(ev) => { const f = ev.target.files?.[0]; if (f) subirRevision(f); ev.target.value = ""; }} />
      </div>

      {e.revisiones.length === 0 ? (
        <p className="text-[11px] text-white/25">Todavía no ha vuelto ninguna.</p>
      ) : (
        <div className="space-y-1.5">
          {e.revisiones.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
              <FileMusic size={14} className="text-white/30 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/75 truncate">rev-{String(r.num).padStart(2, "0")} · {r.nombre}</p>
                <p className="text-[11px] text-white/30 truncate">
                  {r.bytes ? `${(r.bytes / 1e6).toFixed(1)} MB · ` : ""}{cuando(r.subido_at)}
                  {r.nota && <span className="italic"> · {r.nota}</span>}
                </p>
              </div>
              {/* "en la compu", no "aplicado": el .rpp cae en REVISIONES/ y ahí se
                  queda. Aplicarlo solo significaría escribir el proyecto de
                  trabajo, que es lo más peligroso de todo el script. */}
              {r.ultimo_error ? (
                <span title={r.ultimo_error} className="flex items-center gap-1 text-[11px] text-red-300 shrink-0">
                  <AlertTriangle size={11} /> falló
                </span>
              ) : r.bajado_at ? (
                <span title={r.ruta_local ?? undefined} className="flex items-center gap-1 text-[11px] text-green-300/70 shrink-0">
                  <Check size={11} /> en la compu
                </span>
              ) : (
                <span className="text-[11px] text-white/25 shrink-0">esperando sincronización</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Quien edita ve primero lo suyo; el estudio ve primero el envío.
  return (
    <div className="space-y-4">
      {soyQuienEdita ? <>{bloqueRevisiones}{bloqueEnvio}</> : <>{bloqueEnvio}{bloqueRevisiones}</>}
    </div>
  );
}
