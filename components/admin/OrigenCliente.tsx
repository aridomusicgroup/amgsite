"use client";
import { useEffect, useState } from "react";
import { ORIGENES, ORIGENES_CON_ENLACE } from "@/lib/origenes";

export interface OrigenValor {
  origen: string;
  /** Reel de Instagram (social_posts.id). */
  origen_post_id: string;
  /** Link del video de TikTok / YouTube / Facebook. */
  origen_enlace: string;
}

export const ORIGEN_VACIO: OrigenValor = { origen: "", origen_post_id: "", origen_enlace: "" };

interface Reel { id: string; caption: string; publicado_at: string | null; reproducciones: number }

const fechaCorta = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "";

/**
 * "¿Cómo llegó el cliente?" — el origen, y si fue por un video, cuál.
 *
 * Instagram deja elegir el reel de la lista sincronizada; TikTok, YouTube y
 * Facebook, pegar el link del video (no tenemos su lista). El reel es opcional:
 * saber el canal ya sirve, saber el reel sirve más.
 */
export function OrigenCliente({ value, onChange, requerido = false, inputClass, labelClass }: {
  value: OrigenValor;
  onChange: (v: OrigenValor) => void;
  requerido?: boolean;
  inputClass: string;
  labelClass: string;
}) {
  const [reels, setReels] = useState<Reel[] | null>(null);
  const esIg = value.origen === "instagram";

  useEffect(() => {
    if (!esIg || reels !== null) return;
    let vivo = true;
    fetch("/api/admin/social-posts?limite=80", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { reels: [] }))
      .then((d) => { if (vivo) setReels(d.reels ?? []); })
      .catch(() => { if (vivo) setReels([]); });
    return () => { vivo = false; };
  }, [esIg, reels]);

  const set = (patch: Partial<OrigenValor>) => onChange({ ...value, ...patch });

  return (
    <>
      <div>
        <label className={labelClass}>
          ¿Cómo llegó el cliente?{requerido && " *"}
          <span className="text-white/25"> (no dónde se cerró)</span>
        </label>
        <select
          value={value.origen}
          onChange={(e) => onChange({ origen: e.target.value, origen_post_id: "", origen_enlace: "" })}
          required={requerido}
          className={inputClass}
        >
          <option value="" className="bg-lgb-dark">— elige —</option>
          {ORIGENES.map((o) => <option key={o.id} value={o.id} className="bg-lgb-dark">{o.label}</option>)}
        </select>
      </div>
      {esIg && (
        <div className="col-span-2">
          <label className={labelClass}>¿De qué reel? <span className="text-white/25">(opcional)</span></label>
          <select value={value.origen_post_id} onChange={(e) => set({ origen_post_id: e.target.value })} className={inputClass}>
            <option value="" className="bg-lgb-dark">{reels === null ? "Cargando reels…" : "No sé / no aplica"}</option>
            {(reels ?? []).map((r) => (
              <option key={r.id} value={r.id} className="bg-lgb-dark">
                {fechaCorta(r.publicado_at)} · {(r.caption || "sin descripción").replace(/\s+/g, " ").slice(0, 60)} · {r.reproducciones.toLocaleString("es-MX")} reprod.
              </option>
            ))}
          </select>
        </div>
      )}
      {ORIGENES_CON_ENLACE.includes(value.origen) && (
        <div className="col-span-2">
          <label className={labelClass}>Link del video <span className="text-white/25">(opcional)</span></label>
          <input
            type="url"
            value={value.origen_enlace}
            onChange={(e) => set({ origen_enlace: e.target.value })}
            placeholder="https://www.tiktok.com/@…/video/…"
            className={inputClass}
          />
        </div>
      )}
    </>
  );
}
