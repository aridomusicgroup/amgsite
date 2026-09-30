"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Send, Check, Loader2, Music4, Package, Layers } from "lucide-react";
import { toast } from "@/lib/toast";
import type { RenderJob } from "@/lib/render-jobs";
import { Fila, Seccion, EstadoJob, fecha, dia } from "./ficha-ui";

const ETIQUETA: Record<string, string> = { previo: "previo", entregables: "entregables", stems: "stems" };

/**
 * Compartir con el cliente un render ya terminado. Misma ruta y misma pregunta
 * que en la ficha del proyecto: no hay marcha atrás, le llega el correo.
 */
function useCompartir() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const compartir = async (j: RenderJob) => {
    if (!confirm(`¿Compartir estos ${ETIQUETA[j.tipo] ?? j.tipo} con el cliente? Le llega un correo y le quedan en su cuenta.`)) return;
    setBusy(j.id);
    try {
      const res = await fetch("/api/admin/render", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: j.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast(`⚠️ ${d.error || "No se pudo compartir"}`); return; }
      toast(d.avisado ? `✓ Compartido — se le avisó a ${d.avisado}` : `✓ Compartido${d.omitido ? ` (sin correo: ${d.omitido})` : ""}`);
      router.refresh();
    } catch {
      toast("⚠️ No se pudo compartir");
    } finally {
      setBusy(null);
    }
  };
  return { busy, compartir };
}

/** Lo que dice si el cliente ya lo tiene, o el botón para dárselo. */
function ConElCliente({ j, busy, onCompartir }: { j: RenderJob; busy: boolean; onCompartir: () => void }) {
  const url = j.driveUrls?.[0]?.url ?? null;
  return (
    <>
      {j.compartir ? (
        <span className="flex items-center gap-1 text-[11px] text-green-300"
          title={j.avisadoEn ? `Se le avisó el ${dia(j.avisadoEn)}` : "Lo ve en su cuenta, sin correo"}>
          <Check size={11} /> Con el cliente{j.avisadoEn ? ` · avisado ${dia(j.avisadoEn)}` : " · sin correo"}
        </span>
      ) : j.estado !== "listo" ? (
        <EstadoJob job={j} />
      ) : url ? (
        <>
          <span className="text-[11px] text-white/40">Sólo interno</span>
          <button onClick={onCompartir} disabled={busy}
            title="Compartirlo con el cliente y avisarle por correo"
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-white/70 hover:bg-lgb-red/20 hover:text-white transition-colors disabled:opacity-50 cursor-pointer">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Compartir
          </button>
        </>
      ) : (
        <span className="text-[11px] text-white/35" title="No llegó a subirse a Drive: sigue en el disco del estudio">Sólo en la PC</span>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir en Drive" className="text-white/40 hover:text-white p-1">
          <ExternalLink size={13} />
        </a>
      )}
    </>
  );
}

/** Los previos de ESTA canción que fueron para el cliente (no los de músico). */
export function FichaPrevios({ jobs, nombres }: { jobs: RenderJob[]; nombres: Record<string, string> }) {
  const { busy, compartir } = useCompartir();
  const previos = jobs.filter((j) => j.tipo === "previo");

  return (
    <Seccion id="cliente" titulo="Previos al cliente">
      {previos.length === 0 ? (
        <p className="text-xs text-white/35">Todavía no se ha hecho ningún previo de esta canción.</p>
      ) : (
        <div className="space-y-1.5">
          {previos.map((j) => {
            // Un previo que subió un músico y aprobamos también es un "previo".
            const deMusico = j.origen === "musico" && j.musicoId;
            const titulo = deMusico
              ? `Previo de ${nombres[j.musicoId!] ?? "un músico"}`
              : j.previoNum ? `Previo ${j.previoNum}` : "Previo";
            return (
              <Fila key={j.id} icono={<Music4 size={14} />} titulo={titulo} detalle={fecha(j.createdAt)}>
                <ConElCliente j={j} busy={busy === j.id} onCompartir={() => compartir(j)} />
              </Fila>
            );
          })}
        </div>
      )}
    </Seccion>
  );
}

/** Stems y entregables: si ya salieron y si el cliente ya los tiene. */
export function FichaStems({ jobs }: { jobs: RenderJob[] }) {
  const { busy, compartir } = useCompartir();
  const lista = jobs.filter((j) => j.tipo === "stems" || j.tipo === "entregables");

  return (
    <Seccion id="stems" titulo="Stems y entregables">
      {lista.length === 0 ? (
        <p className="text-xs text-white/35">No se han renderizado stems ni entregables todavía.</p>
      ) : (
        <div className="space-y-1.5">
          {lista.map((j) => {
            const n = j.driveUrls?.length ?? 0;
            const detalle = `${fecha(j.createdAt)}${n ? ` · ${n} archivo(s) en Drive` : ""}${j.opciones?.entrega ? " · parte de una entrega" : ""}`;
            return (
              <Fila key={j.id}
                icono={j.tipo === "stems" ? <Layers size={14} /> : <Package size={14} />}
                titulo={j.tipo === "stems" ? "Stems" : "Entregables"}
                detalle={detalle}>
                <ConElCliente j={j} busy={busy === j.id} onCompartir={() => compartir(j)} />
              </Fila>
            );
          })}
        </div>
      )}
    </Seccion>
  );
}
