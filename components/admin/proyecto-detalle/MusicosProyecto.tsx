"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Headphones, FileMusic, Loader2, Check, Send, HardDriveDownload, AlertCircle } from "lucide-react";
import { toast } from "@/lib/toast";

interface ArchivoMusico {
  id: string;
  clase: "previo" | "stem";
  nombre: string;
  bytes: number | null;
  subido_at: string;
  aprobado_at: string | null;
  bajado_at: string | null;
  importado_at: string | null;
  pista: string | null;
  error: string | null;
  musico?: string;
  instrumento?: string;
}

const tam = (b: number | null) =>
  b == null ? "" : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

const cuando = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Lo que mandaron los músicos externos de este proyecto.
 *
 * El botón de compartir es el ÚNICO camino de un previo hacia el cliente: hasta
 * que alguien lo aprieta, el archivo existe en Drive y en esta lista, y para el
 * cliente no existe. Es a propósito — un previo es la primera impresión de la
 * canción, y una toma que no aprobamos no debería llegarle con nuestro nombre.
 */
export function MusicosProyecto({ proyectoId }: { proyectoId: string }) {
  const router = useRouter();
  const [archivos, setArchivos] = useState<ArchivoMusico[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/musico-archivos?proyecto_id=${proyectoId}`, { cache: "no-store" });
      setArchivos(r.ok ? ((await r.json()).archivos ?? []) : []);
    } catch { setArchivos([]); }
  }, [proyectoId]);

  useEffect(() => { cargar(); }, [cargar]);

  const compartir = async (a: ArchivoMusico) => {
    setBusy(a.id);
    try {
      const r = await fetch("/api/admin/musico-archivos", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${d.error || "No se pudo compartir"}`); return; }
      toast(d.avisado ? `✓ Compartido — se le avisó a ${d.avisado}` : "✓ Compartido con el cliente");
      await cargar();
      router.refresh();
    } finally { setBusy(null); }
  };

  if (archivos === null) {
    return <p className="text-xs text-white/30 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Cargando…</p>;
  }
  if (!archivos.length) return null;

  return (
    <div>
      <p className="text-[11px] text-white/35 uppercase tracking-wider mb-2">De los músicos</p>
      <div className="space-y-1.5">
        {archivos.map((a) => (
          <div key={a.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
            {a.clase === "previo"
              ? <Headphones size={14} className="text-white/30 shrink-0" />
              : <FileMusic size={14} className="text-white/30 shrink-0" />}

            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/75 truncate">
                {a.musico} <span className="text-white/35">· {a.instrumento}</span>
              </p>
              <p className="text-[11px] text-white/30 truncate">
                {a.nombre} · {tam(a.bytes)} · {cuando(a.subido_at)}
              </p>
            </div>

            {a.clase === "previo" ? (
              a.aprobado_at ? (
                <span className="flex items-center gap-1 text-[11px] text-green-300 shrink-0"><Check size={11} /> con el cliente</span>
              ) : (
                <button onClick={() => compartir(a)} disabled={busy === a.id}
                  title="Compartirlo con el cliente y avisarle, igual que un previo nuestro"
                  className="flex items-center gap-1.5 bg-lgb-red text-white px-2.5 py-1 rounded-lg text-xs hover:bg-red-700 disabled:opacity-40 shrink-0 cursor-pointer">
                  {busy === a.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Compartir
                </button>
              )
            ) : (
              <EstadoStem a={a} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** En qué va una pista: subida → bajada a la PC → dentro del proyecto de REAPER. */
function EstadoStem({ a }: { a: ArchivoMusico }) {
  if (a.error) {
    return (
      <span title={a.error} className="flex items-center gap-1 text-[11px] text-red-300 shrink-0">
        <AlertCircle size={11} /> falló
      </span>
    );
  }
  if (a.importado_at) {
    return (
      <span title={a.pista ? `Entró en la pista ${a.pista}` : undefined}
        className="flex items-center gap-1 text-[11px] text-green-300 shrink-0">
        <Check size={11} /> {a.pista ? `en ${a.pista}` : "en el proyecto"}
      </span>
    );
  }
  if (a.bajado_at) {
    return <span className="flex items-center gap-1 text-[11px] text-white/45 shrink-0"><HardDriveDownload size={11} /> en la compu</span>;
  }
  return <span className="text-[11px] text-white/30 shrink-0">esperando la sincronización</span>;
}
