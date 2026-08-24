"use client";
import { useState } from "react";
import { ExternalLink, Check } from "lucide-react";

interface Props {
  cursoId: string;
  leccionId: string;
  tipo: "video" | "pdf" | "link";
  urlExterna: string | null;
  vistoInicial: boolean;
}

export function LeccionViewer({ cursoId, leccionId, tipo, urlExterna, vistoInicial }: Props) {
  const [visto, setVisto] = useState(vistoInicial);
  const [busy, setBusy] = useState(false);
  const archivoUrl = `/api/cuenta/curso/${cursoId}/leccion/${leccionId}/archivo`;

  const marcar = async (v: boolean) => {
    setBusy(true);
    try {
      await fetch(`/api/cuenta/curso/${cursoId}/leccion/${leccionId}/progreso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visto: v }),
      });
      setVisto(v);
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      {tipo === "video" && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={archivoUrl}
          controls
          className="w-full rounded-2xl bg-black aspect-video"
          onEnded={() => { if (!visto) marcar(true); }}
        />
      )}

      {tipo === "pdf" && (
        <iframe src={archivoUrl} className="w-full h-[70vh] rounded-2xl border border-white/8 bg-white" />
      )}

      {tipo === "link" && urlExterna && (
        <a
          href={urlExterna}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-lgb-red text-white py-4 rounded-2xl text-sm font-medium hover:bg-red-700 transition-all"
        >
          <ExternalLink size={16} /> Abrir material
        </a>
      )}

      <button
        onClick={() => marcar(!visto)}
        disabled={busy}
        className={`self-start flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ${
          visto ? "bg-green-500/15 text-green-400" : "bg-white/8 text-white/60 hover:text-white"
        }`}
      >
        <Check size={15} /> {visto ? "Vista" : "Marcar como vista"}
      </button>
    </div>
  );
}
