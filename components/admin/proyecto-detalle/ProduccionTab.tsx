"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileAudio, Send, Check, Loader2 } from "lucide-react";
import type { ProyectoDetalle, RenderJobResumen } from "@/lib/erp-data";
import { toast } from "@/lib/toast";
import { MusicosProyecto } from "./MusicosProyecto";

const TIPO_LABEL: Record<string, string> = { previo: "Previo", entregables: "Entregables", stems: "Stems", musico: "Previo p/ músico" };
const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-white/8 text-white/50", procesando: "bg-amber-500/15 text-amber-300",
  listo: "bg-green-500/15 text-green-300", error: "bg-red-500/15 text-red-300",
};

/**
 * Los renders de este proyecto y el estado de lo que mandaron los músicos.
 *
 * Pedir un render nuevo sigue siendo cosa de REAPER. Lo único que sí se decide
 * aquí es COMPARTIR uno ya terminado con el cliente: la casilla de avisar viene
 * desmarcada al lanzarlo, así que sin este botón un previo que salió sin marcar
 * se quedaría interno para siempre y habría que volver a renderizarlo.
 */
export function ProduccionTab({ proyecto }: { proyecto: ProyectoDetalle }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const sinRenders = !proyecto.renderJobs.length && !proyecto.renderInventario.length;

  const compartir = async (r: RenderJobResumen) => {
    const que = (TIPO_LABEL[r.tipo] ?? r.tipo).toLowerCase();
    // Se pregunta porque no hay marcha atrás: le llega el correo y le queda el
    // archivo en su cuenta. Apagar el booleano después no deshace nada de eso.
    if (!confirm(`¿Compartir este ${que} con el cliente? Le llega un correo y le queda en su cuenta.`)) return;
    setBusy(r.id);
    try {
      const res = await fetch("/api/admin/render", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id }),
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

  return (
    <div className="space-y-4">
      {sinRenders && (
        <p className="text-sm text-white/30">Sin renders todavía — se generan desde REAPER (reaper-sync).</p>
      )}

      <MusicosProyecto proyectoId={proyecto.id} />

      {proyecto.renderJobs.length > 0 && (
        <div>
          <p className="text-[11px] text-white/35 uppercase tracking-wider mb-2">Renders</p>
          <div className="space-y-1.5">
            {proyecto.renderJobs.map((r) => {
              const enDrive = r.drive_urls?.[0]?.url ?? null;
              // Un render con músico va PARA él, por enlace privado; no es algo
              // que se le comparta al cliente desde aquí. El previo que el músico
              // sube y aprobamos también trae músico, y ya nace compartido.
              const paraMusico = Boolean(r.musico_id);
              const compartible = r.estado === "listo" && !r.compartir && !paraMusico && Boolean(enDrive);
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileAudio size={14} className="text-white/30 shrink-0" />
                    <span className="text-sm text-white/75">{TIPO_LABEL[r.tipo] ?? r.tipo}</span>
                    <span className="text-xs text-white/30">{new Date(r.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.compartir ? (
                      <span className="flex items-center gap-1 text-[11px] text-green-300/70" title={r.avisado_en ? `Se le avisó el ${new Date(r.avisado_en).toLocaleDateString("es-MX")}` : "Lo ve en su cuenta, sin correo"}>
                        <Check size={11} /> Con el cliente
                      </span>
                    ) : compartible ? (
                      <button
                        onClick={() => compartir(r)}
                        disabled={busy === r.id}
                        title="Compartirlo con el cliente y avisarle por correo"
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-white/60 hover:bg-lgb-red/20 hover:text-white transition-colors disabled:opacity-50"
                      >
                        {busy === r.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Compartir
                      </button>
                    ) : r.estado === "listo" && !paraMusico ? (
                      <span className="text-[11px] text-white/25" title="No llegó a subirse a Drive">Solo interno</span>
                    ) : null}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${ESTADO_COLOR[r.estado] ?? "bg-white/8 text-white/50"}`}>{r.estado}</span>
                    {enDrive && (
                      <a href={enDrive} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white"><ExternalLink size={13} /></a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {proyecto.renderInventario.length > 0 && (
        <p className="text-xs text-white/30">Inventario de REAPER: {proyecto.renderInventario.length} pista(s) escaneada(s) desde la última sincronización.</p>
      )}
    </div>
  );
}
