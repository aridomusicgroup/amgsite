"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertCircle, Headphones, FileMusic, Check, Clock, X, Trash2, MapPin } from "lucide-react";
import type { ArchivoMusico } from "@/lib/musico-data";

/**
 * Lo que el músico sube, directo del navegador a Google Drive.
 *
 * Mismo mecanismo que `components/cuenta/SubirArchivos.tsx`: el servidor solo
 * presta un token corto y dice a qué carpeta, y los bytes nunca pasan por
 * Vercel — un stem en WAV son decenas de MB y no caben en una función
 * serverless.
 *
 * Son DOS botones y no uno porque los dos archivos van a lugares distintos: el
 * previo se le comparte al cliente (tras el visto bueno del estudio) y la pista
 * baja a la computadora del estudio para entrar al proyecto de REAPER.
 *
 * Y tres redes para equivocarse sin daño (Jorge subió su trombón a otro
 * proyecto): siempre dice A DÓNDE va, avisa si el archivo no dura lo que el
 * proyecto del estudio, y se puede cancelar a media subida o quitar lo subido
 * mientras no haya entrado a REAPER.
 */

/** El previo tiene que ser mp3: el reproductor del panel del cliente solo toca mp3. */
const CLASES = {
  previo: {
    label: "Mandar un previo",
    ayuda: "Un MP3 para que lo escuchen. Se comparte con el cliente solo si el estudio lo aprueba.",
    accept: "audio/mpeg,.mp3",
    valido: (n: string) => /\.mp3$/i.test(n),
    error: "El previo tiene que ser un MP3 — es el único formato que se puede escuchar desde el panel.",
  },
  stem: {
    label: "Mandar mi pista",
    ayuda: "El WAV de tu grabación. Entra directo al proyecto del estudio.",
    accept: "audio/wav,audio/x-wav,.wav",
    valido: (n: string) => /\.wav$/i.test(n),
    error: "La pista tiene que ser un WAV — un MP3 pierde calidad y ya no sirve para mezclar.",
  },
} as const;

type Clase = keyof typeof CLASES;

/** Más que esto de diferencia con el proyecto y se le pregunta: 2 s o 2 %, lo que sea mayor. */
const tolerancia = (ref: number) => Math.max(2, ref * 0.02);

const mmss = (s: number) => {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
};

/** Cuánto dura el archivo, leído en el navegador (sin subir nada). null si no se pudo. */
function duracionDe(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const fin = (v: number | null) => {
      clearTimeout(reloj);
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const reloj = setTimeout(() => fin(null), 8000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => fin(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
    audio.onerror = () => fin(null);
    audio.src = url;
  });
}

interface Pendiente { clase: Clase; file: File; slot: number; dura: number }

export function SubirParte({ asignacionId, archivos, canales, destino, duracionRef, temaRef }: {
  asignacionId: string;
  archivos: ArchivoMusico[];
  /** Nombres de los canales que se le piden. 0 o 1 = una sola pista. */
  canales: string[];
  /** "TEMA · PROYECTO": se le enseña siempre, antes de elegir el archivo. */
  destino: string;
  /** Lo que dura el proyecto en el estudio, si ya se midió. */
  duracionRef: number | null;
  /** Cómo llamar a lo que se compara en el aviso ("LA KHABALAH"). */
  temaRef: string;
}) {
  const router = useRouter();
  const previoRef = useRef<HTMLInputElement>(null);
  const stemRef = useRef<HTMLInputElement>(null);
  const inputDe = (clase: Clase) => (clase === "previo" ? previoRef : stemRef);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const sesionRef = useRef<string | null>(null);
  const canceladaRef = useRef(false);
  // Cuántas pistas se le piden. Con dos o más, sale un botón por cada una: así
  // el músico dice cuál es cuál en vez de que lo adivinemos por el orden.
  const huecos = canales.length > 1 ? canales : [null];
  const [hueco, setHueco] = useState(0);
  const [subiendo, setSubiendo] = useState<Clase | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Pendiente | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const limpiarInput = (clase: Clase) => {
    const el = inputDe(clase).current;
    if (el) el.value = "";
  };

  /** Antes de subir: formato y, si hay con qué comparar, la duración. */
  const elegir = async (clase: Clase, file: File, slot: number) => {
    setError(null);
    setInfo(null);
    const cfg = CLASES[clase];
    if (!cfg.valido(file.name)) { setError(cfg.error); limpiarInput(clase); return; }
    if (duracionRef) {
      const dura = await duracionDe(file);
      if (dura !== null && Math.abs(dura - duracionRef) > tolerancia(duracionRef)) {
        setAviso({ clase, file, slot, dura });
        return;
      }
    }
    await subir(clase, file, slot);
  };

  const subir = async (clase: Clase, file: File, slot = 0) => {
    setAviso(null);
    setSubiendo(clase);
    setProgreso(0);
    canceladaRef.current = false;
    try {
      const r = await fetch(`/api/musico/asignacion/${asignacionId}/drive-token`);
      if (!r.ok) throw new Error("no-token");
      const t = await r.json();
      if (canceladaRef.current) throw new Error("cancelada");

      const init = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t.accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": file.type || "application/octet-stream",
        },
        // El nombre lo arma el servidor para que en Drive se lea de quién es y
        // de qué instrumento, sin depender de cómo lo haya nombrado el músico.
        body: JSON.stringify({
          // El canal entra en el nombre para que en Drive se distingan las dos
          // charchetas sin abrirlas — y para que la segunda no pise a la primera.
          name: `${t.prefijo}${canales[slot] ? canales[slot] + " - " : ""}${file.name.replace(/^.*[\\/]/, "")}`,
          parents: [t.folderId],
        }),
      });
      if (!init.ok) throw new Error("google");
      const location = init.headers.get("Location");
      if (!location) throw new Error("google");
      sesionRef.current = location;
      if (canceladaRef.current) throw new Error("cancelada");

      const driveId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", location);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) return reject(new Error("subida"));
          try { resolve(String(JSON.parse(xhr.responseText).id || "")); }
          catch { reject(new Error("subida")); }
        };
        xhr.onabort = () => reject(new Error("cancelada"));
        xhr.onerror = () => reject(new Error("subida"));
        xhr.send(file);
      });
      if (!driveId) throw new Error("subida");

      // Este paso NO es opcional (a diferencia del portal de clientes): es lo
      // que registra el archivo y avisa al estudio. Sin él, el archivo queda en
      // Drive y nadie se entera.
      const conf = await fetch(`/api/musico/asignacion/${asignacionId}/subida-confirmada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clase, nombre: file.name, driveId, bytes: file.size, slot }),
      });
      if (!conf.ok) throw new Error("registro");

      router.refresh();
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (m === "cancelada") {
        setInfo("Subida cancelada. No se guardó nada.");
      } else {
        setError(
          m === "registro"
            ? "Tu archivo subió, pero no se pudo avisar al estudio. Mándales un mensaje para que lo revisen."
            : `No se pudo subir "${file.name}". Revisa tu internet e intenta de nuevo.`,
        );
      }
    } finally {
      xhrRef.current = null;
      sesionRef.current = null;
      setSubiendo(null);
      setProgreso(0);
      limpiarInput(clase);
    }
  };

  /** Corta la subida y le avisa a Google que descarte lo que llevaba. */
  const cancelar = () => {
    canceladaRef.current = true;
    const sesion = sesionRef.current;
    xhrRef.current?.abort();
    // Google responde 499 a esto: es la forma documentada de tirar una sesión
    // resumible. Si falla, la sesión muere sola en una semana sin archivo.
    if (sesion) fetch(sesion, { method: "DELETE" }).catch(() => { /* */ });
  };

  const borrar = async (a: ArchivoMusico) => {
    const aDonde = a.bajado_at ? "Se borra también de la computadora del estudio." : "Todavía no llegaba al estudio.";
    if (!window.confirm(`¿Quitar "${a.nombre}"? ${aDonde} Después puedes mandar el bueno.`)) return;
    setError(null);
    setInfo(null);
    setBorrando(a.id);
    try {
      const r = await fetch(`/api/musico/asignacion/${asignacionId}/archivo?archivo=${encodeURIComponent(a.id)}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "No se pudo quitar. Intenta de nuevo."); return; }
      setInfo(`Se quitó "${a.nombre}".`);
      router.refresh();
    } catch {
      setError("No se pudo quitar. Revisa tu internet e intenta de nuevo.");
    } finally {
      setBorrando(null);
    }
  };

  const reelegir = (p: Pendiente) => {
    setAviso(null);
    limpiarInput(p.clase);
    if (p.clase === "stem") setHueco(p.slot);
    inputDe(p.clase).current?.click();
  };

  const ocupado = subiendo !== null || aviso !== null;

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 text-xs text-white/45">
        <MapPin size={13} className="shrink-0 mt-0.5 text-white/30" />
        <span>Vas a subir a: <b className="text-white/80 font-medium">{destino}</b></span>
      </p>

      <div>
        <button
          onClick={() => { setHueco(0); previoRef.current?.click(); }}
          disabled={ocupado}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm bg-white/8 text-white hover:bg-white/15 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {subiendo === "previo" ? <Loader2 size={15} className="animate-spin" /> : <Headphones size={15} />}
          {subiendo === "previo" ? `Subiendo… ${progreso}%` : CLASES.previo.label}
        </button>
        <p className="text-white/25 text-[11px] mt-1.5 leading-snug">{CLASES.previo.ayuda}</p>
        <input ref={previoRef} type="file" accept={CLASES.previo.accept} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) elegir("previo", f, 0); }} />
      </div>

      {/* Una pista, o una por canal cuando se le piden varias */}
      <div className={huecos.length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : ""}>
        {huecos.map((canal, i) => {
          const suyas = archivos.filter((a) => a.clase === "stem" && a.slot === i);
          const yaEsta = suyas.length > 0;
          // Ya dentro del proyecto de REAPER: cambiarla es cosa del estudio.
          const enProyecto = suyas.some((a) => a.importado_at);
          const activo = subiendo === "stem" && hueco === i;
          return (
            <button
              key={i}
              onClick={() => { setHueco(i); stemRef.current?.click(); }}
              disabled={ocupado || enProyecto}
              title={enProyecto ? "Ya está en el proyecto del estudio. Si hay que cambiarla, avísales." : undefined}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm bg-lgb-red text-white hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {activo ? <Loader2 size={15} className="animate-spin" />
                : yaEsta ? <Check size={15} />
                : <FileMusic size={15} />}
              {activo ? `Subiendo… ${progreso}%`
                : enProyecto ? (canal ? `Pista ${i + 1} en el proyecto` : "Tu pista ya está en el proyecto")
                : canal ? `${yaEsta ? "Cambiar" : "Mandar"} pista ${i + 1}`
                : yaEsta ? "Cambiar mi pista"
                : CLASES.stem.label}
              {canal && <span className="opacity-60 text-xs">· {canal}</span>}
            </button>
          );
        })}
      </div>
      <p className="text-white/25 text-[11px] -mt-1 leading-snug">
        {CLASES.stem.ayuda}
        {huecos.length > 1 && " Son dos: manda cada una en su botón para que no se crucen."}
      </p>
      <input ref={stemRef} type="file" accept={CLASES.stem.accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) elegir("stem", f, hueco); }} />

      {aviso && (
        <div role="alertdialog" aria-live="assertive" className="rounded-xl border border-amber-400/30 bg-amber-500/[0.07] p-3.5">
          <p className="flex items-start gap-1.5 text-sm text-amber-200">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>
              Tu archivo dura <b>{mmss(aviso.dura)}</b> y {temaRef} en el estudio dura <b>{mmss(duracionRef ?? 0)}</b>.
              ¿Seguro que es el correcto?
            </span>
          </p>
          <p className="text-[11px] text-white/40 mt-1 ml-5 break-all">{aviso.file.name}</p>
          <div className="flex flex-wrap gap-2 mt-3 ml-5">
            <button onClick={() => subir(aviso.clase, aviso.file, aviso.slot)}
              className="rounded-lg px-3 py-1.5 text-xs bg-lgb-red text-white hover:bg-red-700 cursor-pointer">
              Sí, subir
            </button>
            <button onClick={() => reelegir(aviso)}
              className="rounded-lg px-3 py-1.5 text-xs bg-white/8 text-white hover:bg-white/15 cursor-pointer">
              Elegir otro
            </button>
          </div>
        </div>
      )}

      {subiendo && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-lgb-red transition-all" style={{ width: `${progreso}%` }} />
          </div>
          <button onClick={cancelar}
            className="flex items-center gap-1 text-xs text-white/55 hover:text-white rounded-lg px-2 py-1 bg-white/5 hover:bg-white/10 cursor-pointer">
            <X size={12} /> Cancelar
          </button>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-300">
          <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
        </p>
      )}
      {info && !error && <p className="text-xs text-white/50">{info}</p>}

      {archivos.length > 0 && (
        <ul className="space-y-1 pt-1">
          {archivos.map((a) => {
            // Mientras no haya entrado a REAPER (o, un previo, al cliente) es suyo para quitarlo.
            const quitable = a.clase === "stem" ? !a.importado_at : !a.aprobado_at;
            return (
              <li key={a.id} className="flex items-center gap-2 text-xs text-white/45">
                <Upload size={11} className="shrink-0 text-white/25" />
                <span className="truncate flex-1">{a.nombre}</span>
                <Estado a={a} />
                {quitable && (
                  <button onClick={() => borrar(a)} disabled={borrando !== null || subiendo !== null}
                    aria-label={`Quitar ${a.nombre}`} title="Quitar este archivo"
                    className="shrink-0 p-1 rounded text-white/30 hover:text-red-300 hover:bg-white/5 disabled:opacity-40 cursor-pointer">
                    {borrando === a.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * En qué va cada archivo, en palabras que le sirvan al músico.
 *
 * A propósito NO dice "aprobado" ni "rechazado": si el estudio decide no
 * compartir su previo con el cliente, eso es una conversación entre personas,
 * no un letrero rojo en su pantalla.
 */
function Estado({ a }: { a: ArchivoMusico }) {
  if (a.clase === "previo") {
    return a.aprobado_at ? (
      <span className="flex items-center gap-1 text-green-300/80 shrink-0"><Check size={11} /> compartido</span>
    ) : (
      <span className="flex items-center gap-1 text-white/30 shrink-0"><Clock size={11} /> con el estudio</span>
    );
  }
  if (a.importado_at) return <span className="flex items-center gap-1 text-green-300/80 shrink-0"><Check size={11} /> en el proyecto</span>;
  if (a.bajado_at) return <span className="flex items-center gap-1 text-green-300/80 shrink-0"><Check size={11} /> recibida</span>;
  return <span className="flex items-center gap-1 text-white/30 shrink-0"><Clock size={11} /> enviada</span>;
}
