"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, ShieldCheck, Volume2, VolumeX, Unlink } from "lucide-react";
import { toast } from "@/lib/toast";
import { EditorCarpeta } from "@/components/admin/AuditoriaEntrega";
import { FORMATOS, type BeatAuditado, type Formato } from "@/lib/beats-auditoria";
import type { BeatDetalleAdmin } from "@/lib/beat-admin";
import { Pastilla, Seccion } from "./comun";

const urlCarpeta = (id: string) => `https://drive.google.com/drive/folders/${id}`;

function Archivos({ archivos }: { archivos: Partial<Record<Formato, number>> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FORMATOS.map((f) => {
        const n = archivos[f];
        if (n === undefined) return <Pastilla key={f} tono="neutro">{f}: no existe</Pastilla>;
        if (n === 0) return <Pastilla key={f} tono="grave">{f}: vacía</Pastilla>;
        return <Pastilla key={f} tono="ok">{f}: {n} archivo{n === 1 ? "" : "s"}</Pastilla>;
      })}
    </div>
  );
}

/**
 * Audio y entrega: que el beat SUENE en la tienda y que, si alguien lo compra,
 * haya archivos que mandarle en cada licencia.
 */
export function EntregaTab({ d }: { d: BeatDetalleAdmin }) {
  const router = useRouter();
  const [trayendo, setTrayendo] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [rev, setRev] = useState<BeatAuditado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const traerAudio = async () => {
    setTrayendo(true);
    try {
      const r = await fetch("/api/admin/add-beat", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, resync: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast(`⚠️ ${j.error || "No se pudo traer el audio."}`); return; }
      toast(`${j.audio ? "✓" : "⏳"} ${j.mensaje}`);
      if (j.audio) router.refresh();
    } finally {
      setTrayendo(false);
    }
  };

  const revisar = async () => {
    setRevisando(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/beats/${encodeURIComponent(d.id)}/entrega`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || "No se pudo revisar."); return; }
      setRev(j.revision);
    } catch {
      setError("Error de conexión.");
    } finally {
      setRevisando(false);
    }
  };

  const quitarManual = async () => {
    if (!confirm("¿Quitar el link puesto a mano y volver a la carpeta automática?")) return;
    setQuitando(true);
    try {
      const r = await fetch(`/api/admin/beats/carpeta?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
      if (!r.ok) { toast("⚠️ No se pudo quitar el link."); return; }
      toast("Link a mano quitado");
      setRev(null);
      router.refresh();
    } finally {
      setQuitando(false);
    }
  };

  const archivosVistos = rev?.archivos ?? d.carpeta?.archivos ?? null;

  return (
    <div className="space-y-4">
      <Seccion
        titulo="Audio del preview"
        nota="Sin audio, el botón de play de la tienda manda a BeatStars en vez de sonar."
        derecha={d.audio ? <Pastilla tono="ok"><Volume2 size={12} /> Suena</Pastilla> : <Pastilla tono="alerta"><VolumeX size={12} /> Sin audio</Pastilla>}
      >
        {d.audio ? (
          <p className="text-[12px] text-white/45">El preview se reproduce en la tienda.</p>
        ) : d.source === "agregado" ? (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[12px] text-white/55 flex-1 min-w-48">
              BeatStars convierte el audio unos minutos DESPUÉS de subir el beat. Si ya pasó un rato, tráelo:
            </p>
            <button onClick={traerAudio} disabled={trayendo}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer">
              {trayendo ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />}
              {trayendo ? "Pidiendo a BeatStars…" : "Traer audio de BeatStars"}
            </button>
          </div>
        ) : (
          <p className="text-[12px] text-white/55">El audio de los beats originales viene del archivo del catálogo; éste no trae preview.</p>
        )}
      </Seccion>

      <Seccion
        titulo="Carpeta de entrega (Drive)"
        nota="De aquí salen los archivos que recibe quien compra: Basic = MP3 · Premium = MP3 + WAV · Premium Plus y Exclusiva = + STEMS."
        derecha={d.carpeta
          ? <Pastilla tono={d.carpeta.manual ? "info" : "neutro"}>{d.carpeta.manual ? "link a mano" : "automática"}</Pastilla>
          : <Pastilla tono="grave">sin carpeta</Pastilla>}
      >
        {d.carpeta ? (
          <a href={urlCarpeta(d.carpeta.folderId)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white underline-offset-2 hover:underline">
            <ExternalLink size={12} /> Abrir la carpeta que usa el sistema
          </a>
        ) : (
          <p className="text-[12px] text-red-300/90">Se vende pero NO se entrega: el cliente pagaría sin recibir archivos.</p>
        )}

        {archivosVistos && (
          <div className="mt-3">
            <p className="text-[11px] font-medium text-white/55 mb-1.5">
              {rev ? "Lo que hay en Drive ahora" : "Lo que se vio al asignarla (puede haber cambiado)"}
            </p>
            <Archivos archivos={archivosVistos} />
          </div>
        )}

        {rev && (
          <div className="mt-3 space-y-1 text-[12px]">
            {rev.puedeEntregar.length > 0 && <p className="text-green-300/90">Se puede entregar: {rev.puedeEntregar.join(" · ")}</p>}
            {rev.noPuedeEntregar.length > 0 && <p className="text-amber-300/90">NO se puede entregar: {rev.noPuedeEntregar.join(" · ")}</p>}
            {rev.sueltos > 0 && <p className="text-white/40">{rev.sueltos} archivo{rev.sueltos === 1 ? "" : "s"} suelto{rev.sueltos === 1 ? "" : "s"} en la raíz (fuera de MP3/WAV/STEMS).</p>}
          </div>
        )}

        {error && <p className="text-red-300 text-[12px] mt-3">{error}</p>}

        <div className="flex items-center gap-3 flex-wrap mt-4">
          <button onClick={revisar} disabled={revisando}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 cursor-pointer">
            {revisando ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
            {revisando ? "Revisando Drive…" : "Revisar archivos ahora"}
          </button>
          {d.carpeta?.manual && (
            <button onClick={quitarManual} disabled={quitando}
              className="flex items-center gap-1.5 text-white/45 hover:text-white text-xs disabled:opacity-50 cursor-pointer">
              <Unlink size={12} /> Volver a la automática
            </button>
          )}
        </div>
        <EditorCarpeta
          beatId={d.id}
          tieneCarpeta={Boolean(d.carpeta)}
          onGuardado={() => { toast("✓ Carpeta guardada"); setRev(null); router.refresh(); }}
        />
        {d.cuentaServicio && (
          <p className="text-[11px] text-white/35 mt-3 leading-relaxed">
            La carpeta debe estar compartida como Lector con <code className="text-white/60">{d.cuentaServicio}</code>; si no, Drive la reporta vacía sin avisar.
          </p>
        )}
      </Seccion>
    </div>
  );
}
