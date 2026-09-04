"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, AlertCircle, Headphones, FileMusic, Check, Clock } from "lucide-react";
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

export function SubirParte({ asignacionId, archivos, canales }: {
  asignacionId: string;
  archivos: ArchivoMusico[];
  /** Nombres de los canales que se le piden. 0 o 1 = una sola pista. */
  canales: string[];
}) {
  const router = useRouter();
  const refs = { previo: useRef<HTMLInputElement>(null), stem: useRef<HTMLInputElement>(null) };
  // Cuántas pistas se le piden. Con dos o más, sale un botón por cada una: así
  // el músico dice cuál es cuál en vez de que lo adivinemos por el orden.
  const huecos = canales.length > 1 ? canales : [null];
  const [hueco, setHueco] = useState(0);
  const [subiendo, setSubiendo] = useState<Clase | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const subir = async (clase: Clase, file: File, slot = 0) => {
    setError(null);
    const cfg = CLASES[clase];
    if (!cfg.valido(file.name)) { setError(cfg.error); return; }

    setSubiendo(clase);
    setProgreso(0);
    try {
      const r = await fetch(`/api/musico/asignacion/${asignacionId}/drive-token`);
      if (!r.ok) throw new Error("no-token");
      const t = await r.json();

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

      const driveId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", location);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) return reject(new Error("subida"));
          try { resolve(String(JSON.parse(xhr.responseText).id || "")); }
          catch { reject(new Error("subida")); }
        };
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
      setError(
        e instanceof Error && e.message === "registro"
          ? "Tu archivo subió, pero no se pudo avisar al estudio. Mándales un mensaje para que lo revisen."
          : `No se pudo subir "${file.name}". Revisa tu internet e intenta de nuevo.`,
      );
    } finally {
      setSubiendo(null);
      setProgreso(0);
      if (refs[clase].current) refs[clase].current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <button
          onClick={() => { setHueco(0); refs.previo.current?.click(); }}
          disabled={subiendo !== null}
          className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm bg-white/8 text-white hover:bg-white/15 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {subiendo === "previo" ? <Loader2 size={15} className="animate-spin" /> : <Headphones size={15} />}
          {subiendo === "previo" ? `Subiendo… ${progreso}%` : CLASES.previo.label}
        </button>
        <p className="text-white/25 text-[11px] mt-1.5 leading-snug">{CLASES.previo.ayuda}</p>
        <input ref={refs.previo} type="file" accept={CLASES.previo.accept} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) subir("previo", f, 0); }} />
      </div>

      {/* Una pista, o una por canal cuando se le piden varias */}
      <div className={huecos.length > 1 ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : ""}>
        {huecos.map((canal, i) => {
          const yaEsta = archivos.some((a) => a.clase === "stem" && a.slot === i);
          const activo = subiendo === "stem" && hueco === i;
          return (
            <button
              key={i}
              onClick={() => { setHueco(i); refs.stem.current?.click(); }}
              disabled={subiendo !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm bg-lgb-red text-white hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {activo ? <Loader2 size={15} className="animate-spin" />
                : yaEsta ? <Check size={15} />
                : <FileMusic size={15} />}
              {activo ? `Subiendo… ${progreso}%`
                : canal ? `${yaEsta ? "Cambiar" : "Mandar"} pista ${i + 1}`
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
      <input ref={refs.stem} type="file" accept={CLASES.stem.accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) subir("stem", f, hueco); }} />

      {subiendo && (
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-lgb-red transition-all" style={{ width: `${progreso}%` }} />
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-300">
          <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
        </p>
      )}

      {archivos.length > 0 && (
        <ul className="space-y-1 pt-1">
          {archivos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-xs text-white/45">
              <Upload size={11} className="shrink-0 text-white/25" />
              <span className="truncate flex-1">{a.nombre}</span>
              <Estado a={a} />
            </li>
          ))}
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
