"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Users, Heart, Play, Grid3x3, ExternalLink, TrendingUp, TrendingDown } from "lucide-react";
import type { AnaliticaData, AnaliticaPost, AnaliticaSnapshot } from "@/lib/analitica";
import { toast } from "@/lib/toast";

const nf = new Intl.NumberFormat("es-MX");

const TIPO_LABEL: Record<string, string> = {
  REELS: "Reel", VIDEO: "Video", CAROUSEL_ALBUM: "Carrusel", IMAGE: "Foto", FEED: "Foto",
};

export function AnaliticaPanel({ data, isAdmin }: { data: AnaliticaData | null; isAdmin: boolean }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const sincronizar = async () => {
    setSyncing(true);
    try {
      const r = await fetch("/api/admin/analitica/sync", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { toast("✓ Sincronizado con Instagram"); router.refresh(); }
      else {
        const detalle = Array.isArray(j.results) ? j.results.find((x: { ok: boolean }) => !x.ok)?.error : null;
        toast("⚠️ " + (detalle ?? j.error ?? "No se pudo sincronizar"));
      }
    } catch {
      toast("⚠️ No se pudo sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-center">
        <p className="text-white/60">Aún no hay datos de analítica.</p>
        <p className="text-white/35 text-sm mt-1 max-w-md mx-auto">
          {isAdmin
            ? "Ya está todo listo en código. Corre el SQL en Supabase y pulsa Sincronizar para traer las métricas de Instagram."
            : "Pídele a un admin que haga la primera sincronización."}
        </p>
        {isAdmin && (
          <button onClick={sincronizar} disabled={syncing}
            className="mt-4 inline-flex items-center gap-2 bg-lgb-red text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-red-700 disabled:opacity-50">
            {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Sincronizar ahora
          </button>
        )}
      </div>
    );
  }

  const { cuenta, seguidores, seguidoresDelta, publicaciones, interaccionesTotales, reproduccionesTotales, snapshots, posts, ultimaSync } = data;
  const topPosts = [...posts].sort((a, b) => (b.reproducciones - a.reproducciones) || (b.interacciones - a.interacciones)).slice(0, 12);
  const conSeguidores = snapshots.filter((s) => s.seguidores != null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-lg font-coolvetica">{cuenta.nombre}</p>
          {ultimaSync && <p className="text-white/30 text-xs">Última sincronización: {ultimaSync}</p>}
        </div>
        {isAdmin && (
          <button onClick={sincronizar} disabled={syncing}
            className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/12 text-white px-4 py-2 rounded-full text-sm disabled:opacity-50">
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sincronizar
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<Users size={16} />} label="Seguidores" value={seguidores != null ? nf.format(seguidores) : "—"} delta={seguidoresDelta} />
        <Kpi icon={<Grid3x3 size={16} />} label="Publicaciones" value={nf.format(publicaciones)} />
        <Kpi icon={<Heart size={16} />} label="Interacciones" value={nf.format(interaccionesTotales)} hint="likes + comentarios + guardados + compartidos" />
        <Kpi icon={<Play size={16} />} label="Reproducciones" value={nf.format(reproduccionesTotales)} hint="reels + videos" />
      </div>

      {conSeguidores.length > 1 && <Sparkline snapshots={conSeguidores} />}

      <div>
        <h2 className="font-coolvetica text-lg mb-3">Top publicaciones</h2>
        {topPosts.length === 0 ? (
          <p className="text-white/40 text-sm">Aún no hay publicaciones sincronizadas.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topPosts.map((p) => <PostCard key={p.media_id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, delta, hint }: { icon: ReactNode; label: string; value: string; delta?: number | null; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-white/40 text-xs">{icon}{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-2xl font-coolvetica tabular-nums">{value}</span>
        {delta != null && delta !== 0 && (
          <span className={`text-xs flex items-center gap-0.5 ${delta > 0 ? "text-green-400" : "text-red-400"}`}>
            {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{nf.format(Math.abs(delta))}
          </span>
        )}
      </div>
      {hint && <p className="text-white/25 text-[10px] mt-0.5">{hint}</p>}
    </div>
  );
}

function Sparkline({ snapshots }: { snapshots: AnaliticaSnapshot[] }) {
  const pts = snapshots.map((s) => s.seguidores as number);
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1;
  const w = 100, h = 30;
  const d = pts.map((v, i) => {
    const x = pts.length > 1 ? (i / (pts.length - 1)) * w : 0;
    const y = h - ((v - min) / range) * h;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-white/40 text-xs mb-2">Crecimiento de seguidores</p>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-16">
        <path d={d} fill="none" stroke="var(--color-lgb-red)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-white/25 text-[10px] mt-1">
        <span>{snapshots[0]?.fecha}</span><span>{snapshots[snapshots.length - 1]?.fecha}</span>
      </div>
    </div>
  );
}

function PostCard({ p }: { p: AnaliticaPost }) {
  const tipo = (p.tipo && TIPO_LABEL[p.tipo]) ?? "Foto";
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden flex flex-col">
      <div className="aspect-square bg-white/5 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.thumbnail
          ? <img src={p.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">sin imagen</div>}
        <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded-full bg-black/60 text-white">{tipo}</span>
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        {p.caption && <p className="text-white/60 text-xs line-clamp-2">{p.caption}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50 mt-auto">
          {p.reproducciones > 0 && <span title="Reproducciones">▶️ {nf.format(p.reproducciones)}</span>}
          <span title="Me gusta">❤️ {nf.format(p.likes)}</span>
          <span title="Comentarios">💬 {nf.format(p.comentarios)}</span>
          {p.compartidos > 0 && <span title="Compartidos">🔁 {nf.format(p.compartidos)}</span>}
          {p.guardados > 0 && <span title="Guardados">🔖 {nf.format(p.guardados)}</span>}
          {p.alcance > 0 && <span title="Alcance">👁️ {nf.format(p.alcance)}</span>}
        </div>
        {p.permalink && (
          <a href={p.permalink} target="_blank" rel="noopener noreferrer"
            className="text-lgb-red text-[11px] inline-flex items-center gap-1 hover:underline">
            Ver en Instagram <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}
