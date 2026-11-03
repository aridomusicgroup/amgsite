"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { esWav, type EstadoVoz } from "@/lib/voces-cliente";
import { abrirSubida, subirASesion } from "@/lib/subida-navegador";

interface Voz {
  id: string;
  nombre: string;
  bytes: number | null;
  temaId: string | null;
  estado: EstadoVoz;
}

interface Tema {
  id: string;
  titulo: string;
}

interface Estado {
  pideTema: boolean;
  temas: Tema[];
  voces: Voz[];
}

const formatoTamano = (bytes: number | null): string => {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Avisa a "Sube tus archivos" que cambió lo usado de la carpeta. */
export const EVENTO_ARCHIVOS = "cuenta:archivos";

/** Lo que muestra la caja, o null si este pedido no la lleva (o falta el SQL). */
async function leerVoces(pedidoId: string): Promise<Estado | null> {
  try {
    const res = await fetch(`/api/cuenta/pedido/${pedidoId}/voces`);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.acepta || !d.disponible) return null;
    return { pideTema: Boolean(d.pideTema), temas: d.temas ?? [], voces: d.voces ?? [] };
  } catch {
    return null; // sin la caja de voces el pedido sigue igual
  }
}

/**
 * Las voces del cliente para la mezcla. Suben directo a Drive (como
 * `SubirArchivos`: el servidor abre la sesión de cada voz en la carpeta del
 * proyecto y el navegador nunca tiene un token), y al terminar cada una se
 * anota en el servidor — eso es lo que hace que el estudio la meta sola
 * a su sesión de REAPER, en VOX GRP, una voz por canal.
 *
 * Se suben UNA POR UNA a propósito: el orden de subida es el orden de los
 * canales (la primera a LEAD, la segunda a PC LEAD…). En paralelo, quien
 * terminara primero se quedaría con LEAD.
 */
export function SubirVoces({ pedidoId }: { pedidoId: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [temaId, setTemaId] = useState("");
  const [subiendo, setSubiendo] = useState<{ nombre: string; pct: number; faltan: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargar = async (): Promise<void> => {
    const e = await leerVoces(pedidoId);
    if (e) setEstado(e);
  };

  useEffect(() => {
    let vivo = true;
    leerVoces(pedidoId).then((e) => { if (vivo) setEstado(e); });
    return () => { vivo = false; };
  }, [pedidoId]);

  /** Cuánto le queda al proyecto: el mismo espacio que muestra "Sube tus archivos". */
  const pedirLibres = async (): Promise<number | null> => {
    const res = await fetch(`/api/cuenta/pedido/${pedidoId}/espacio`);
    if (!res.ok) return null;
    const d = await res.json();
    return d.limiteBytes > 0 ? d.limiteBytes - (d.usadoBytes ?? 0) : Number.POSITIVE_INFINITY;
  };

  const onFiles = async (lista: FileList | null): Promise<void> => {
    if (!lista?.length || !estado || subiendo) return;
    setError(null);
    const files = Array.from(lista);
    const malos = files.filter((f) => !esWav(f.name));
    if (malos.length) {
      setError(`${malos.map((f) => `“${f.name}”`).join(", ")} no ${malos.length === 1 ? "es" : "son"} WAV. Exporta cada voz en WAV y vuelve a subirla.`);
      return;
    }
    if (estado.pideTema && !temaId) { setError("Primero elige de qué canción son las voces."); return; }

    // Todas o ninguna: si sólo cupieran las primeras, faltarían canales en la sesión.
    const libres = await pedirLibres();
    if (libres == null) { setError("No se pudo conectar con Drive. Intenta de nuevo en un momento."); return; }
    const total = files.reduce((a, f) => a + f.size, 0);
    if (total > libres) {
      setError(`No caben: tus voces pesan ${formatoTamano(total)} y te quedan ${formatoTamano(libres)}. Escríbenos si necesitas más espacio.`);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setSubiendo({ nombre: f.name, pct: 0, faltan: files.length - i - 1 });
      try {
        // Una sesión por voz, abierta justo antes de subirla: así el servidor cobra
        // el espacio con lo que ya subieron las anteriores.
        const sesion = await abrirSubida(pedidoId, f, "voz");
        // Google responde el archivo creado: de ahí sale su id, que el servidor verifica.
        const driveId = await subirASesion(sesion, f, (pct) => setSubiendo({ nombre: f.name, pct, faltan: files.length - i - 1 }));
        const res = await fetch(`/api/cuenta/pedido/${pedidoId}/voces`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: f.name, driveId, temaId: estado.pideTema ? temaId : null }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "No se pudo mandar al estudio.");
        }
        await cargar();
      } catch (e) {
        setError(`“${f.name}”: ${e instanceof Error ? e.message : "no se pudo subir"}${i < files.length - 1 ? " — las que seguían no se subieron." : ""}`);
        break; // parar: si siguieran, cambiaría el orden de los canales
      }
    }
    setSubiendo(null);
    if (inputRef.current) inputRef.current.value = "";
    window.dispatchEvent(new Event(EVENTO_ARCHIVOS));
  };

  if (!estado) return null;

  const tituloTema = (id: string | null) => estado.temas.find((t) => t.id === id)?.titulo ?? null;
  const sinTema = estado.pideTema && !temaId;

  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-2 font-coolvetica text-xl mb-1">
        <Mic size={18} className="text-lgb-red" /> Tus voces para la mezcla
      </h2>
      <p className="text-white/50 text-xs leading-relaxed mb-4">
        Sube cada voz como un <b className="text-white/70">WAV aparte</b> (voz principal, segundas, coros…), exportada
        desde el inicio del beat para que caiga en su lugar. Entran directo a tu sesión en el estudio.
      </p>

      {estado.pideTema && (
        <label className="block mb-3">
          <span className="block text-[11px] text-white/40 mb-1">¿De qué canción son?</span>
          <select
            value={temaId}
            onChange={(e) => setTemaId(e.target.value)}
            disabled={Boolean(subiendo)}
            className="w-full rounded-xl border border-white/15 bg-lgb-black px-3 py-2.5 text-sm text-white focus:border-lgb-red/60 outline-none"
          >
            <option value="">Elige la canción</option>
            {estado.temas.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
          </select>
        </label>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-disabled={sinTema || Boolean(subiendo)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
        onClick={() => { if (!subiendo && !sinTema) inputRef.current?.click(); else if (sinTema) setError("Primero elige de qué canción son las voces."); }}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !subiendo && !sinTema) inputRef.current?.click(); }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${sinTema ? "border-white/10 opacity-60 cursor-not-allowed" : "border-white/15 hover:border-lgb-red/50 cursor-pointer"} bg-white/[0.02]`}
      >
        <input ref={inputRef} type="file" accept=".wav,audio/wav,audio/x-wav" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        {subiendo ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={22} className="animate-spin text-lgb-red" />
            <p className="text-white/60 text-sm truncate max-w-full">Subiendo {subiendo.nombre}… {subiendo.pct}%</p>
            <div className="w-full max-w-xs h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-lgb-red transition-all" style={{ width: `${subiendo.pct}%` }} />
            </div>
            {subiendo.faltan > 0 && <p className="text-white/30 text-xs">Faltan {subiendo.faltan} — no cierres esta página</p>}
          </div>
        ) : (
          <>
            <Mic size={22} className="mx-auto mb-2 text-white/30" />
            <p className="text-white/60 text-sm">Arrastra tus voces aquí o toca para elegirlas</p>
            <p className="text-white/30 text-xs mt-1">Sólo WAV · puedes elegir varias a la vez</p>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-red-400 text-xs mt-2"><AlertCircle size={13} className="shrink-0 mt-px" /> {error}</p>
      )}

      {estado.voces.length > 0 && (
        <ul className="flex flex-col gap-2 mt-3">
          {estado.voces.map((v) => {
            const tema = tituloTema(v.temaId);
            return (
              <li key={v.id} className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5">
                <Mic size={15} className="text-white/40 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white/80">{v.nombre}</span>
                  {(tema || v.bytes != null) && (
                    <span className="block text-white/30 text-[11px]">{[tema, formatoTamano(v.bytes)].filter(Boolean).join(" · ")}</span>
                  )}
                </span>
                {v.estado === "en_sesion" ? (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 shrink-0"><CheckCircle2 size={12} /> En tu sesión</span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-white/40 shrink-0"><Clock size={12} /> Recibida</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
