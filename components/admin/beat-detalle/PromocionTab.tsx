"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, Loader2, Plus, Trash2, Eye, Heart, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast";
import { canalDeUrl, limpiarUrl, type Canal } from "@/lib/beat-ficha";
import type { BeatDetalleAdmin, PublicacionBeat } from "@/lib/beat-admin";
import { fechaCorta, inp, lblS, Pastilla, Seccion } from "./comun";

const CANAL: Record<Canal, string> = {
  youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", otro: "Otro",
};

const compacto = (n: number) => Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(n);

async function llamar(id: string, init: RequestInit & { query?: string }): Promise<string | null> {
  try {
    const r = await fetch(`/api/admin/beats/${encodeURIComponent(id)}/publicaciones${init.query ?? ""}`, {
      ...init, headers: { "Content-Type": "application/json" },
    });
    if (r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return j.error || "No se pudo guardar.";
  } catch {
    return "Error de conexión.";
  }
}

/**
 * Promoción: en qué video de YouTube y en qué reels salió el beat. Sirve para
 * saber qué beats nunca se han movido en redes, y para poner el video en la
 * página pública del beat.
 */
export function PromocionTab({ d }: { d: BeatDetalleAdmin }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [fecha, setFecha] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (d.publicaciones === null) {
    return (
      <Seccion titulo="Promoción">
        <p className="text-sm text-amber-300/90">Falta correr supabase-beat-ficha.sql para poder registrar videos y reels.</p>
      </Seccion>
    );
  }

  const limpio = limpiarUrl(url);
  const canal = limpio ? canalDeUrl(limpio) : null;

  const agregar = async (cuerpo: Record<string, unknown>, clave: string) => {
    setOcupado(clave);
    setError(null);
    const err = await llamar(d.id, { method: "POST", body: JSON.stringify(cuerpo) });
    setOcupado(null);
    if (err) { setError(err); return false; }
    toast("✓ Registrado");
    router.refresh();
    return true;
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limpio) { setError("Pega el link completo del video o del post."); return; }
    if (await agregar({ url: limpio, publicado_at: fecha || null }, "nuevo")) { setUrl(""); setFecha(""); }
  };

  const mostrar = async (p: PublicacionBeat) => {
    setOcupado(p.id);
    const err = await llamar(d.id, { method: "PATCH", body: JSON.stringify({ pub: p.id, mostrar_en_tienda: !p.mostrar_en_tienda }) });
    setOcupado(null);
    if (err) { toast(`⚠️ ${err}`); return; }
    toast(p.mostrar_en_tienda ? "El video ya no sale en la tienda" : "✓ El video sale en la página del beat");
    router.refresh();
  };

  const quitar = async (p: PublicacionBeat) => {
    if (!confirm("¿Quitar este link del beat? (no borra nada en la red social)")) return;
    setOcupado(p.id);
    const err = await llamar(d.id, { method: "DELETE", query: `?pub=${p.id}` });
    setOcupado(null);
    if (err) { toast(`⚠️ ${err}`); return; }
    router.refresh();
  };

  const pubs = d.publicaciones;
  const porCanal = new Map<Canal, number>();
  for (const p of pubs) porCanal.set(p.canal, (porCanal.get(p.canal) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <Seccion
        titulo="Dónde se promocionó"
        nota="Cada video o reel en el que salió este beat. Los reels de Instagram que ya sincronizamos traen sus números."
        derecha={pubs.length === 0 ? <Pastilla tono="alerta">sin promoción</Pastilla> : undefined}
      >
        {pubs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[...porCanal.entries()].map(([c, n]) => <Pastilla key={c}>{CANAL[c]}: {n}</Pastilla>)}
          </div>
        )}

        {pubs.length === 0 ? (
          <p className="text-sm text-white/45">Todavía no hay videos ni reels registrados de este beat.</p>
        ) : (
          <ul className="divide-y divide-white/8 -my-1">
            {pubs.map((p) => (
              <li key={p.id} className="py-2.5 flex items-center gap-3">
                <div className="w-16 h-10 rounded-md overflow-hidden bg-white/5 shrink-0">
                  {p.miniatura && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.miniatura} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/85 truncate">{p.titulo || p.url}</p>
                  <p className="text-[12px] text-white/45 flex flex-wrap items-center gap-x-2">
                    <span>{CANAL[p.canal]}</span>
                    {p.publicado_at && <span>· {fechaCorta(p.publicado_at)}</span>}
                    {p.metricas && (
                      <>
                        <span className="inline-flex items-center gap-0.5">· <Eye size={11} /> {compacto(p.metricas.reproducciones)}</span>
                        <span className="inline-flex items-center gap-0.5"><Heart size={11} /> {compacto(p.metricas.likes)}</span>
                      </>
                    )}
                  </p>
                </div>
                {p.canal === "youtube" && (
                  <button onClick={() => mostrar(p)} disabled={ocupado === p.id}
                    title="Incrustar este video en la página pública del beat"
                    className={`text-[11px] px-2 py-1 rounded-full border shrink-0 cursor-pointer disabled:opacity-50 ${
                      p.mostrar_en_tienda ? "border-green-500/30 bg-green-500/12 text-green-300" : "border-white/10 text-white/45 hover:text-white/80"}`}>
                    {p.mostrar_en_tienda ? "En la tienda" : "Mostrar en tienda"}
                  </button>
                )}
                <a href={p.url} target="_blank" rel="noopener noreferrer" title="Abrir" className="text-white/35 hover:text-white shrink-0 p-1">
                  <ExternalLink size={14} />
                </a>
                <button onClick={() => quitar(p)} disabled={ocupado === p.id} title="Quitar"
                  className="text-white/30 hover:text-red-300 shrink-0 p-1 cursor-pointer disabled:opacity-40">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      {d.sugerenciasIg.length > 0 && (
        <Seccion
          titulo="¿Salió en estos reels?"
          nota={<>Reels sincronizados de Instagram que mencionan <span className="font-medium text-white/70">{d.nombreCorto.toUpperCase()}</span>. Lígalos con un clic.</>}
          derecha={<Sparkles size={15} className="text-amber-300/80" />}
        >
          <ul className="grid sm:grid-cols-2 gap-2">
            {d.sugerenciasIg.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-black/15 p-2">
                <div className="w-11 h-11 rounded-md overflow-hidden bg-white/5 shrink-0">
                  {s.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.thumbnail} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-white/75 line-clamp-2 leading-snug">{s.caption || "Reel sin texto"}</p>
                  <p className="text-[11px] text-white/35">{fechaCorta(s.publicado_at)} · {compacto(s.reproducciones)} vistas</p>
                </div>
                <button onClick={() => agregar({ social_post_id: s.id }, s.id)} disabled={ocupado !== null}
                  title="Ligar este reel al beat"
                  className="shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/35 cursor-pointer disabled:opacity-40">
                  {ocupado === s.id ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />} Ligar
                </button>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      <Seccion titulo="Agregar un link" nota="YouTube, Instagram, TikTok o Facebook. De YouTube se trae solo el título y la miniatura.">
        <form onSubmit={enviar} className="grid sm:grid-cols-[1fr_10rem_auto] gap-3 items-end">
          <div>
            <label className={lblS} htmlFor="p-url">Link {canal && <span className="text-white/40 font-normal">· {CANAL[canal]}</span>}</label>
            <input id="p-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/…" className={inp} />
          </div>
          <div>
            <label className={lblS} htmlFor="p-fecha">Publicado (opcional)</label>
            <input id="p-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inp} />
          </div>
          <button type="submit" disabled={!url.trim() || ocupado !== null}
            className="flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-sm px-4 min-h-9 rounded-lg disabled:opacity-40 cursor-pointer">
            {ocupado === "nuevo" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Agregar
          </button>
        </form>
        {error && <p className="text-red-300 text-sm mt-2">{error}</p>}
      </Seccion>
    </div>
  );
}
