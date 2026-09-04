"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, ExternalLink, Loader2, File as FileIconLucide, Folder, ChevronRight } from "lucide-react";
import { toast } from "@/lib/toast";

interface DriveFile {
  id: string; name: string; mimeType: string; size?: string;
  createdTime?: string; modifiedTime?: string; webViewLink?: string;
  thumbnailLink?: string; iconLink?: string;
}

/**
 * Explorador embebido de la carpeta de Drive del proyecto. La subida va
 * directo del navegador a Drive (mismo mecanismo de token corto que ya usa
 * reaper-sync) — así los renders grandes no pasan por el límite de payload
 * de Vercel. Las miniaturas SÍ pasan por nuestro proxy (`drive-files/thumb`)
 * porque `thumbnailLink` exige el mismo Authorization que el resto de esta
 * integración; un <img> directo del navegador recibiría 403.
 */
const CARPETA = "application/vnd.google-apps.folder";

export function DriveTab({ proyectoId }: { proyectoId: string }) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  /**
   * Por dónde va la navegación. Empieza vacío = la raíz del proyecto.
   *
   * Hace falta porque los renders y lo que mandan los músicos NO viven sueltos:
   * están en PREVIOS, ENTREGABLES y MUSICOS, y esta pestaña solo enseñaba el
   * nivel de arriba. La subida sigue yendo siempre a la raíz.
   */
  const [ruta, setRuta] = useState<{ id: string; nombre: string }[]>([]);
  const [uploadToken, setUploadToken] = useState<{ accessToken: string; expiresAt: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const aplicar = useCallback((d: { error?: string; files?: DriveFile[]; nextPageToken?: string | null; folderId?: string | null; upload?: typeof uploadToken }, agregar: boolean) => {
    setError(d.error ?? null);
    setFiles((prev) => (agregar ? [...prev, ...(d.files ?? [])] : (d.files ?? [])));
    setNextPageToken(d.nextPageToken ?? null);
    setFolderId(d.folderId ?? null);
    setUploadToken(d.upload ?? null);
  }, []);

  // El fetch de montaje vive inline en el efecto (no delegado a una función con
  // nombre): así el análisis estático puede ver que nada llama setState antes
  // del primer `await`, sin lo cual el compilador de React marca el efecto
  // como riesgo de cascading renders. "Cargar más" y la recarga post-subida sí
  // pueden llamar setState libremente porque parten de un click, no de un efecto.
  useEffect(() => {
    let cancelado = false;
    const dentro = ruta.length ? `?carpeta=${encodeURIComponent(ruta[ruta.length - 1].id)}` : "";
    setLoading(true);
    fetch(`/api/admin/proyectos/${proyectoId}/drive-files${dentro}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelado) aplicar(d, false); })
      .catch(() => { if (!cancelado) setError("No se pudo conectar con Drive."); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [proyectoId, aplicar, ruta]);

  const cargar = useCallback(async (pageToken?: string) => {
    try {
      const qs = new URLSearchParams();
      if (pageToken) qs.set("pageToken", pageToken);
      if (ruta.length) qs.set("carpeta", ruta[ruta.length - 1].id);
      const r = await fetch(`/api/admin/proyectos/${proyectoId}/drive-files${qs.toString() ? `?${qs}` : ""}`);
      aplicar(await r.json(), !!pageToken);
    } catch {
      setError("No se pudo conectar con Drive.");
    } finally {
      setLoading(false);
    }
  }, [proyectoId, aplicar]);

  const cargarMas = () => {
    if (!nextPageToken) return;
    setLoading(true);
    cargar(nextPageToken);
  };

  const subir = async (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    if (!folderId || !uploadToken || uploadToken.expiresAt < Date.now() + 5000) {
      toast("⚠️ El acceso a Drive expiró — recarga la pestaña");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) await subirArchivo(file, folderId, uploadToken.accessToken);
      toast("✓ Subido a Drive");
      await cargar();
    } catch {
      toast("⚠️ No se pudo subir el archivo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">{files.length} archivo{files.length === 1 ? "" : "s"}</p>
        <label className={`flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg ${!folderId || uploading ? "opacity-40" : "cursor-pointer"}`}>
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Subir archivo
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => subir(e.target.files)} disabled={uploading || !folderId} />
        </label>
      </div>

      {ruta.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-white/40 flex-wrap">
          <button onClick={() => setRuta([])} className="hover:text-white transition-colors cursor-pointer">
            Carpeta del proyecto
          </button>
          {ruta.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              <ChevronRight size={11} className="text-white/20" />
              <button
                onClick={() => setRuta((r) => r.slice(0, i + 1))}
                className={i === ruta.length - 1 ? "text-white" : "hover:text-white transition-colors cursor-pointer"}
              >
                {c.nombre}
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-amber-300/80">{error}</p>}

      {loading && !files.length ? (
        <div className="flex items-center gap-2 text-white/40 text-sm py-8 justify-center"><Loader2 size={16} className="animate-spin" /> Cargando archivos…</div>
      ) : !files.length ? (
        <p className="text-sm text-white/30">
          {ruta.length ? "Esta carpeta está vacía." : "Todavía no hay archivos sueltos aquí — los renders y lo de los músicos están en sus carpetas."}
        </p>
      ) : (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
          initial="hidden" animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
        >
          <AnimatePresence>
            {files.map((f) =>
              f.mimeType === CARPETA
                ? <CarpetaCard key={f.id} f={f} onEntrar={() => setRuta((r) => [...r, { id: f.id, nombre: f.name }])} />
                : <ArchivoCard key={f.id} f={f} proyectoId={proyectoId} />,
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {nextPageToken && (
        <button onClick={cargarMas} disabled={loading} className="text-xs text-white/40 hover:text-white mx-auto block">
          {loading ? "Cargando…" : "Cargar más"}
        </button>
      )}
    </div>
  );
}

/** Una subcarpeta: se entra, no se abre en Drive. */
function CarpetaCard({ f, onEntrar }: { f: DriveFile; onEntrar: () => void }) {
  return (
    <motion.button
      onClick={onEntrar}
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} exit={{ opacity: 0 }}
      className="group rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden hover:border-white/20 transition-colors text-left cursor-pointer"
    >
      <div className="aspect-square bg-white/[0.02] flex items-center justify-center">
        <Folder size={30} className="text-lgb-red/60" />
      </div>
      <div className="p-2">
        <p className="text-[11px] text-white/70 truncate">{f.name}</p>
        <p className="text-[10px] text-white/30">carpeta</p>
      </div>
    </motion.button>
  );
}

function ArchivoCard({ f, proyectoId }: { f: DriveFile; proyectoId: string }) {
  const thumbSrc = f.thumbnailLink
    ? `/api/admin/proyectos/${proyectoId}/drive-files/thumb?url=${encodeURIComponent(f.thumbnailLink)}`
    : f.iconLink;
  const tamano = f.size ? formatBytes(Number(f.size)) : null;
  return (
    <motion.a
      href={f.webViewLink} target="_blank" rel="noopener noreferrer"
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} exit={{ opacity: 0 }}
      className="group rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden hover:border-white/20 transition-colors"
    >
      <div className="aspect-square bg-white/[0.02] flex items-center justify-center overflow-hidden">
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura proxiada de Drive, no un asset local optimizable
          <img src={thumbSrc} alt={f.name} className="w-full h-full object-cover" loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }} />
        ) : (
          <FileIconLucide size={28} className="text-white/20" />
        )}
      </div>
      <div className="p-2">
        <p className="text-xs text-white/75 truncate flex items-center gap-1">{f.name} <ExternalLink size={10} className="opacity-0 group-hover:opacity-60 shrink-0" /></p>
        {tamano && <p className="text-[10px] text-white/30">{tamano}</p>}
      </div>
    </motion.a>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function subirArchivo(file: File, folderId: string, accessToken: string): Promise<void> {
  const boundary = "arido-" + Math.random().toString(36).slice(2);
  const metadata = { name: file.name, parents: [folderId] };
  const buffer = await file.arrayBuffer();
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = new Blob([head, buffer, tail]);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error("upload failed");
}
