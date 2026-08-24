"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, FileMusic, Loader2, ExternalLink, AlertCircle } from "lucide-react";

interface ArchivoSubido {
  id: string;
  nombre: string;
  tamano: number | null;
  url: string | null;
}

interface TokenInfo {
  accessToken: string;
  expiresAt: number;
  folderId: string;
  limiteBytes: number;
  usadoBytes: number;
}

const formatoTamano = (bytes: number | null): string => {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

/**
 * Sube archivos directo a Google Drive desde el navegador del cliente — sin
 * pasar por nuestro servidor (así no hay límite de tamaño de Vercel). El
 * servidor solo entrega un token de corta duración y arma la carpeta si hace
 * falta; ver `lib/drive-oauth.ts` y `lib/proyecto-carpeta.ts`.
 */
export function SubirArchivos({ pedidoId }: { pedidoId: string }) {
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [archivos, setArchivos] = useState<ArchivoSubido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [disponible, setDisponible] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargarToken = async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/cuenta/pedido/${pedidoId}/drive-token`);
      if (res.status === 503) { setDisponible(false); return; }
      if (!res.ok) throw new Error("No se pudo conectar con Drive.");
      const data = await res.json();
      setToken({
        accessToken: data.accessToken,
        expiresAt: data.expiresAt,
        folderId: data.folderId,
        limiteBytes: data.limiteBytes ?? 0,
        usadoBytes: data.usadoBytes ?? 0,
      });
      setArchivos(data.archivos ?? []);
    } catch {
      setError("No se pudo cargar tus archivos. Intenta de nuevo en un momento.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarToken(); }, [pedidoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const subir = async (file: File) => {
    setError(null);
    // El único tope ahora es el espacio del proyecto (ver Pedidos → Almacenamiento)
    // — ya no hay un límite fijo de 200MB por archivo sin importar el tipo.
    if (token && token.limiteBytes > 0 && token.usadoBytes + file.size > token.limiteBytes) {
      setError(`"${file.name}" no cabe — ya usaste ${formatoTamano(token.usadoBytes)} de ${formatoTamano(token.limiteBytes)} disponibles. Contáctanos si necesitas más espacio.`);
      return;
    }

    // El token vive ~1h; si ya expiró (sesión larga en la página), se renueva solo.
    let vigente = token;
    if (!vigente || vigente.expiresAt < Date.now() + 30_000) {
      await cargarToken();
      vigente = token;
    }
    if (!vigente) { setError("No se pudo preparar la subida."); return; }

    setSubiendo(true);
    setProgreso(0);
    try {
      const init = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${vigente.accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": file.type || "application/octet-stream",
        },
        body: JSON.stringify({ name: file.name, parents: [vigente.folderId] }),
      });
      if (!init.ok) throw new Error("Google no aceptó la subida.");
      const location = init.headers.get("Location");
      if (!location) throw new Error("Google no regresó dónde subir.");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", location);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgreso(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Falló la subida.")));
        xhr.onerror = () => reject(new Error("Falló la subida."));
        xhr.send(file);
      });

      fetch(`/api/cuenta/pedido/${pedidoId}/subida-confirmada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: file.name }),
      }).catch(() => {});

      await cargarToken(); // refresca la lista con el archivo nuevo
    } catch {
      setError(`No se pudo subir "${file.name}". Intenta de nuevo.`);
    } finally {
      setSubiendo(false);
      setProgreso(0);
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    for (const f of Array.from(files)) subir(f);
  };

  if (!disponible) return null;

  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-2 font-coolvetica text-xl mb-1">
        <Upload size={18} className="text-lgb-red" /> Sube tus archivos
      </h2>

      {token && token.limiteBytes > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] text-white/40 mb-1">
            <span>Usado {formatoTamano(token.usadoBytes)} de {formatoTamano(token.limiteBytes)}</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${token.usadoBytes / token.limiteBytes > 0.9 ? "bg-amber-400" : "bg-lgb-red"}`}
              style={{ width: `${Math.min(100, (token.usadoBytes / token.limiteBytes) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl border-2 border-dashed border-white/15 hover:border-lgb-red/50 bg-white/[0.02] p-6 text-center cursor-pointer transition-colors"
      >
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        {subiendo ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={22} className="animate-spin text-lgb-red" />
            <p className="text-white/60 text-sm">Subiendo… {progreso}%</p>
            <div className="w-full max-w-xs h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-lgb-red transition-all" style={{ width: `${progreso}%` }} />
            </div>
          </div>
        ) : (
          <>
            <Upload size={22} className="mx-auto mb-2 text-white/30" />
            <p className="text-white/60 text-sm">Arrastra un archivo aquí o toca para elegir</p>
            <p className="text-white/30 text-xs mt-1">
              Referencias, letras, audios{token && token.limiteBytes > 0 ? ` — hasta ${formatoTamano(token.limiteBytes - token.usadoBytes)} disponibles` : ""}
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-red-400 text-xs mt-2"><AlertCircle size={13} /> {error}</p>
      )}

      {cargando ? (
        <p className="text-white/30 text-xs mt-3">Cargando…</p>
      ) : archivos.length > 0 ? (
        <div className="flex flex-col gap-2 mt-3">
          {archivos.map((a) => (
            <a
              key={a.id}
              href={a.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-2.5 hover:bg-white/[0.05] transition-colors"
            >
              <FileMusic size={15} className="text-white/40 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm text-white/80">{a.nombre}</span>
              {a.tamano != null && <span className="text-white/30 text-xs shrink-0">{formatoTamano(a.tamano)}</span>}
              <ExternalLink size={12} className="text-white/30 shrink-0" />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
