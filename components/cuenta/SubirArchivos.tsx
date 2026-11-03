"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, FileMusic, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { abrirSubida, subirASesion, type SesionSubida } from "@/lib/subida-navegador";

interface ArchivoSubido {
  id: string;
  nombre: string;
  tamano: number | null;
  url: string | null;
}

interface Espacio {
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
 * Sube archivos directo a Google Drive desde el navegador del cliente — los
 * bytes no pasan por nuestro servidor (así no hay límite de tamaño de Vercel).
 * El servidor abre la sesión de subida de CADA archivo en la carpeta del
 * proyecto (`/api/cuenta/pedido/<id>/subida`) y el navegador sólo recibe la
 * URL de esa sesión, nunca un token de Drive. Ver `lib/subida-servidor.ts`.
 */
export function SubirArchivos({ pedidoId }: { pedidoId: string }) {
  const [espacio, setEspacio] = useState<Espacio | null>(null);
  const [archivos, setArchivos] = useState<ArchivoSubido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [disponible, setDisponible] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cargarEspacio = async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/cuenta/pedido/${pedidoId}/espacio`);
      if (res.status === 503) { setDisponible(false); return; }
      if (!res.ok) throw new Error("No se pudo conectar con Drive.");
      const data = await res.json();
      setEspacio({ limiteBytes: data.limiteBytes ?? 0, usadoBytes: data.usadoBytes ?? 0 });
      setArchivos(data.archivos ?? []);
    } catch {
      setError("No se pudo cargar tus archivos. Intenta de nuevo en un momento.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarEspacio(); }, [pedidoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Tus voces" sube a la misma carpeta: al terminar, lo usado cambió.
  useEffect(() => {
    const recargar = () => { cargarEspacio(); };
    window.addEventListener("cuenta:archivos", recargar);
    return () => window.removeEventListener("cuenta:archivos", recargar);
  }, [pedidoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const subir = async (file: File) => {
    setError(null);
    // El único tope es el espacio del proyecto (ver Pedidos → Almacenamiento).
    // Éste es el aviso rápido; el que vale lo revisa el servidor al abrir la sesión.
    if (espacio && espacio.limiteBytes > 0 && espacio.usadoBytes + file.size > espacio.limiteBytes) {
      setError(`"${file.name}" no cabe — ya usaste ${formatoTamano(espacio.usadoBytes)} de ${formatoTamano(espacio.limiteBytes)} disponibles. Contáctanos si necesitas más espacio.`);
      return;
    }

    setSubiendo(true);
    setProgreso(0);
    try {
      let sesion: SesionSubida;
      try {
        sesion = await abrirSubida(pedidoId, file, "archivo");
      } catch (e) {
        setError(e instanceof Error ? e.message : `No se pudo subir "${file.name}".`);
        return;
      }
      await subirASesion(sesion, file, setProgreso);

      fetch(`/api/cuenta/pedido/${pedidoId}/subida-confirmada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: file.name }),
      }).catch(() => {});

      await cargarEspacio(); // refresca la lista con el archivo nuevo
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

      {espacio && espacio.limiteBytes > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] text-white/40 mb-1">
            <span>Usado {formatoTamano(espacio.usadoBytes)} de {formatoTamano(espacio.limiteBytes)}</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${espacio.usadoBytes / espacio.limiteBytes > 0.9 ? "bg-amber-400" : "bg-lgb-red"}`}
              style={{ width: `${Math.min(100, (espacio.usadoBytes / espacio.limiteBytes) * 100)}%` }}
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
              Referencias, letras, audios{espacio && espacio.limiteBytes > 0 ? ` — hasta ${formatoTamano(espacio.limiteBytes - espacio.usadoBytes)} disponibles` : ""}
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
