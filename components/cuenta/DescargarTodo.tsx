"use client";
import { useEffect, useState } from "react";
import { makeZip } from "client-zip";
import { Download, Loader2, Check } from "lucide-react";

/** Pausa entre descargas sueltas: sin ella el navegador se come algunas. */
const PAUSA_MS = 1200;

interface Archivo { nombre: string; url: string }

type SaveFilePicker = (o: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<WritableStream> }>;

const selectorDeArchivo = (): SaveFilePicker | null => {
  if (typeof window === "undefined") return null;
  const f = (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  return typeof f === "function" ? (f.bind(window) as SaveFilePicker) : null;
};

const limpio = (t: string) => t.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "archivos";

/**
 * Un botón para bajar todos los archivos de una tarjeta (stems, entregables).
 *
 * El .zip se arma EN EL NAVEGADOR y se escribe directo al disco: cada track
 * baja por el mismo proxy de siempre, de uno en uno, sin juntarlos en memoria.
 * No se arma en el servidor a propósito: unos stems son cientos de MB y una
 * función de Vercel se cortaría a media descarga, entregando un zip roto.
 *
 * Escribir al disco necesita `showSaveFilePicker` (Chrome y Edge). Donde no
 * existe (Safari, Firefox) se bajan los archivos sueltos, uno tras otro.
 */
export function DescargarTodo({ archivos, nombreZip }: { archivos: Archivo[]; nombreZip: string }) {
  // Se decide al montar: en el servidor no hay `window` y no debe cambiar el HTML.
  const [conZip, setConZip] = useState(false);
  const [avance, setAvance] = useState<{ hecho: number; total: number } | null>(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setConZip(Boolean(selectorDeArchivo())); }, []);

  const enZip = async (picker: SaveFilePicker) => {
    const destino = await picker({
      suggestedName: `${limpio(nombreZip)}.zip`,
      types: [{ description: "Archivo ZIP", accept: { "application/zip": [".zip"] } }],
    });
    const escritura = await destino.createWritable();
    async function* entradas() {
      for (let i = 0; i < archivos.length; i++) {
        setAvance({ hecho: i + 1, total: archivos.length });
        const res = await fetch(archivos[i].url);
        if (!res.ok) throw new Error(`No se pudo bajar ${archivos[i].nombre}`);
        yield { name: archivos[i].nombre, input: res };
      }
    }
    // Si algo falla a medias, `pipeTo` aborta la escritura y no queda un zip roto.
    await makeZip(entradas()).pipeTo(escritura);
  };

  const sueltos = async () => {
    for (let i = 0; i < archivos.length; i++) {
      setAvance({ hecho: i + 1, total: archivos.length });
      const a = document.createElement("a");
      a.href = `${archivos[i].url}&d=1`;
      a.download = archivos[i].nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (i < archivos.length - 1) await new Promise((r) => setTimeout(r, PAUSA_MS));
    }
  };

  const descargar = async () => {
    if (avance) return;
    setError(null);
    setListo(false);
    try {
      const picker = selectorDeArchivo();
      if (picker) await enZip(picker);
      else await sueltos();
      setListo(true);
    } catch (e) {
      // Cerrar el cuadro de "Guardar como" no es un error.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "No se pudo completar la descarga");
      }
    } finally {
      setAvance(null);
    }
  };

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={descargar}
        disabled={Boolean(avance)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-lgb-red hover:bg-lgb-red/85 disabled:opacity-70 text-white text-sm font-medium transition-colors"
      >
        {avance ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Descargando {avance.hecho} de {avance.total}…
          </>
        ) : listo ? (
          <>
            <Check size={15} /> Descargados · bajar de nuevo
          </>
        ) : (
          <>
            <Download size={15} /> Descargar todo ({archivos.length}){conZip ? " en .zip" : ""}
          </>
        )}
      </button>
      {avance && (
        <p className="text-[11px] text-white/40 mt-1.5 text-center">No cierres esta página hasta que termine.</p>
      )}
      {!avance && !conZip && !listo && (
        <p className="text-[11px] text-white/40 mt-1.5 text-center">
          Se bajan uno tras otro. Si tu navegador pregunta, permite descargar varios archivos.
        </p>
      )}
      {error && <p className="text-[11px] text-red-300 mt-1.5 text-center">{error}. Intenta de nuevo o bájalos uno por uno.</p>}
    </div>
  );
}
