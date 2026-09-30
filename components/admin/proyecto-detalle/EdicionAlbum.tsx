"use client";
import { useState } from "react";
import { ChevronDown, Loader2, Send, Check } from "lucide-react";
import { EdicionClave, envioVivo, mandarAEdicion, peso, type EstadoClave } from "./EdicionClave";

export interface TemaEdicion extends EstadoClave {
  tareaId: string;
  titulo: string;
  falta: string[];
  editado: boolean | null;
}

/**
 * ¿Entra en "mandar los temas listos"? Tiene algo nuevo, no está subiendo, no
 * le falta nada de lo que va antes de editar, y no está ya editado.
 *
 * Lo editado se deja fuera a propósito: cualquier render nuevo en su carpeta
 * cuenta como "algo nuevo", y el botón del disco lo reenviaría cada vez. Para
 * esos está el botón de su propio renglón.
 */
const listo = (t: TemaEdicion) => t.pendientes > 0 && !envioVivo(t) && t.falta.length === 0 && t.editado !== true;

/** El resumen de un tema en una píldora: lo que hay que saber sin abrirlo. */
function Pildora({ t }: { t: TemaEdicion }) {
  const vivo = envioVivo(t);
  const base = "shrink-0 text-[11px] px-2 py-0.5 rounded-full";
  if (t.editado) {
    return <span className={`${base} bg-green-400/10 text-green-300/80 flex items-center gap-1`}><Check size={11} /> editado</span>;
  }
  if (vivo) {
    const pct = t.total ? Math.round((t.subidos / t.total) * 100) : 0;
    return <span className={`${base} bg-white/8 text-white/60`}>{vivo.estado === "abierto" ? "en fila" : `subiendo ${pct}%`}</span>;
  }
  const rev = t.revisiones[0];
  if (rev) return <span className={`${base} bg-white/8 text-white/60`}>rev-{String(rev.num).padStart(2, "0")} de vuelta</span>;
  if (t.envios[0]?.estado === "listo") {
    return <span className={`${base} bg-white/8 text-white/60`}>{t.pendientes ? `enviado · ${t.pendientes} nuevo(s)` : "enviado"}</span>;
  }
  return <span className={`${base} border border-dashed border-white/15 text-white/40`}>sin enviar</span>;
}

interface Props {
  proyectoId: string;
  temas: TemaEdicion[];
  miId: string | null;
  recargar: () => Promise<void> | void;
}

/**
 * El envío a edición de un EP/álbum: un renglón por tema.
 *
 * Cada tema se manda SOLO, cuando está listo — a veces el primero ya se puede
 * editar y al siguiente todavía le faltan las charchetas. El botón de arriba
 * junta en un clic los que ya están listos; nunca manda uno al que le falta algo.
 * Lo que falta es aviso, no candado: el renglón de cada tema lo manda igual,
 * preguntando antes.
 */
export function EdicionAlbum({ proyectoId, temas, miId, recargar }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const listos = temas.filter(listo);

  const enviarListos = async () => {
    const nombres = listos.map((t) => t.titulo).join(", ");
    const nota = prompt(`Se van a mandar ${listos.length} tema(s), uno tras otro: ${nombres}\n\n¿Algo que decirle? (opcional)`);
    if (nota === null) return;
    setBusy("disco");
    try {
      if (await mandarAEdicion({ proyecto_id: proyectoId, tarea_ids: listos.map((t) => t.tareaId), nota })) await recargar();
    } finally { setBusy(null); }
  };

  const enviarTema = async (t: TemaEdicion) => {
    if (t.falta.length && !confirm(`A “${t.titulo}” todavía le falta:\n· ${t.falta.join("\n· ")}\n\n¿Mandarlo a editar así?`)) return;
    const nota = prompt(`“${t.titulo}” — ¿algo que decirle? (opcional)\nEj: ya con las charchetas de Martín`);
    if (nota === null) return;
    setBusy(t.tareaId);
    try {
      if (await mandarAEdicion({ proyecto_id: proyectoId, tarea_id: t.tareaId, nota })) await recargar();
    } finally { setBusy(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] text-white/35 uppercase tracking-wider">Envío a edición · por tema</p>
        <button onClick={enviarListos} disabled={busy !== null || listos.length === 0}
          title={listos.length ? `Manda: ${listos.map((t) => t.titulo).join(", ")}` : "Ningún tema tiene todo lo previo palomeado y algo nuevo que mandar"}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-lgb-red text-white hover:bg-red-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          {busy === "disco" ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
          {listos.length ? `Enviar los listos (${listos.length})` : "Ninguno listo"}
        </button>
      </div>

      <div className="rounded-lg border border-white/8 divide-y divide-white/8">
        {temas.map((t) => {
          const esteAbierto = abierto === t.tareaId;
          const puedeEnviar = t.pendientes > 0 && !envioVivo(t);
          return (
            <div key={t.tareaId}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button onClick={() => setAbierto(esteAbierto ? null : t.tareaId)}
                  aria-expanded={esteAbierto}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer focus-visible:outline-none focus-visible:underline">
                  <ChevronDown size={14} className={`shrink-0 text-white/30 transition-transform ${esteAbierto ? "" : "-rotate-90"}`} />
                  <span className="min-w-0">
                    <span className="block text-sm text-white/80 truncate">{t.titulo}</span>
                    {t.falta.length > 0 && !t.editado && (
                      <span className={`block text-[11px] text-amber-300/70 ${esteAbierto ? "" : "truncate"}`}>falta: {t.falta.join(", ")}</span>
                    )}
                  </span>
                </button>
                <Pildora t={t} />
                {puedeEnviar && (
                  <button onClick={() => enviarTema(t)} disabled={busy !== null}
                    title={`Subir ${t.pendientes} archivo(s) · ${peso(t.bytesPendientes)}`}
                    className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-white/70 hover:bg-white/12 transition-colors disabled:opacity-30 cursor-pointer">
                    {busy === t.tareaId ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Enviar
                  </button>
                )}
              </div>
              {esteAbierto && (
                <div className="px-3 pb-3 pt-1">
                  <EdicionClave proyectoId={proyectoId} tareaId={t.tareaId} titulo={t.titulo}
                    estado={t} miId={miId} recargar={recargar} onEnviar={() => enviarTema(t)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
