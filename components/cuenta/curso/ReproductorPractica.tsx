"use client";
import { useEffect, useRef, useState } from "react";
import { FlipHorizontal2, Repeat, X } from "lucide-react";
import { formatoTiempo, type Marcador } from "@/lib/cursos-tipos";

const VELOCIDADES = [0.5, 0.75, 1] as const;
const GUARDAR_CADA_MS = 15_000;

interface Props {
  src: string;
  marcadores: Marcador[];
  /** Cápsula 9:16: el reproductor se hace angosto y alto. */
  vertical?: boolean;
  segundosIniciales?: number;
  onTerminado?: () => void;
  onPosicion?: (segundos: number) => void;
}

/**
 * El reproductor para PRACTICAR, no sólo para ver: baja a 0.5x sin cambiar
 * el tono, repite un pedazo (A-B), voltea la imagen para ver la mano izquierda
 * como en un espejo, salta por capítulos y retoma donde se quedó.
 */
export function ReproductorPractica({ src, marcadores, vertical, segundosIniciales = 0, onTerminado, onPosicion }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const ultimoGuardado = useRef(0);
  const [vel, setVel] = useState<number>(1);
  const [espejo, setEspejo] = useState(false);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [actual, setActual] = useState(0);

  // Mantener el tono al cambiar la velocidad (el default de los navegadores, pero explícito).
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = vel;
    (v as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch = true;
  }, [vel]);

  const guardar = (seg: number, forzar = false) => {
    if (!onPosicion) return;
    const ahora = Date.now();
    if (!forzar && ahora - ultimoGuardado.current < GUARDAR_CADA_MS) return;
    ultimoGuardado.current = ahora;
    onPosicion(seg);
  };

  const irA = (t: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = t;
    if (v.paused) v.play().catch(() => {});
  };

  const onTimeUpdate = () => {
    const v = ref.current;
    if (!v) return;
    setActual(v.currentTime);
    if (a != null && b != null && b > a && v.currentTime >= b) v.currentTime = a;
    if (!v.paused) guardar(v.currentTime);
  };

  const onLoaded = () => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = vel;
    if (segundosIniciales > 5 && (!v.duration || segundosIniciales < v.duration - 10)) v.currentTime = segundosIniciales;
  };

  const marcarA = () => { const t = ref.current?.currentTime ?? 0; setA(t); if (b != null && b <= t) setB(null); };
  const marcarB = () => { const t = ref.current?.currentTime ?? 0; if (a != null && t > a) { setB(t); irA(a); } };
  const quitarLoop = () => { setA(null); setB(null); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "[") marcarA();
    else if (e.key === "]") marcarB();
    else if (e.key === "m") setEspejo((x) => !x);
    else if (e.key === ",") setVel((x) => VELOCIDADES[Math.max(0, VELOCIDADES.indexOf(x as 1) - 1)] ?? 1);
    else if (e.key === ".") setVel((x) => VELOCIDADES[Math.min(VELOCIDADES.length - 1, VELOCIDADES.indexOf(x as 1) + 1)] ?? 1);
    else return;
    e.preventDefault();
  };

  const chip = (activo: boolean) =>
    `px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${activo ? "bg-lgb-red text-white" : "bg-white/8 text-white/70 hover:text-white"}`;
  const capActual = [...marcadores].reverse().find((m) => actual >= m.t);

  return (
    <div className="flex flex-col gap-3" onKeyDown={onKey}>
      <div className={vertical ? "mx-auto w-full max-w-[340px]" : ""}>
        <video
          ref={ref}
          src={src}
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={onLoaded}
          onTimeUpdate={onTimeUpdate}
          onPause={(e) => guardar(e.currentTarget.currentTime, true)}
          onEnded={() => { guardar(0, true); onTerminado?.(); }}
          style={espejo ? { transform: "scaleX(-1)" } : undefined}
          className={`w-full rounded-2xl bg-black ${vertical ? "aspect-[9/16]" : "aspect-video"}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Controles de práctica">
        {VELOCIDADES.map((v) => (
          <button key={v} onClick={() => setVel(v)} className={chip(vel === v)} aria-pressed={vel === v}>
            {v === 1 ? "1x" : `${v}x`}
          </button>
        ))}
        <span className="w-px h-5 bg-white/10 mx-1" aria-hidden />
        <button onClick={marcarA} className={chip(a != null)} title="Marca el inicio del pedazo a repetir ( [ )">
          A{a != null ? ` ${formatoTiempo(a)}` : ""}
        </button>
        <button onClick={marcarB} disabled={a == null} className={`${chip(b != null)} disabled:opacity-40`} title="Marca el final y repite ( ] )">
          B{b != null ? ` ${formatoTiempo(b)}` : ""}
        </button>
        {a != null && (
          <button onClick={quitarLoop} className={chip(false)} aria-label="Quitar repetición"><X size={13} /></button>
        )}
        {a != null && b != null && <span className="flex items-center gap-1 text-xs text-white/50"><Repeat size={12} /> repitiendo</span>}
        <span className="w-px h-5 bg-white/10 mx-1" aria-hidden />
        <button onClick={() => setEspejo((x) => !x)} className={`${chip(espejo)} flex items-center gap-1`} aria-pressed={espejo} title="Voltea la imagen, como en un espejo ( m )">
          <FlipHorizontal2 size={13} /> Espejo
        </button>
      </div>

      {marcadores.length > 0 && (
        <nav aria-label="Capítulos" className="rounded-2xl border border-white/8 bg-white/[0.02] divide-y divide-white/5">
          {marcadores.map((m) => (
            <button key={`${m.t}-${m.label}`} onClick={() => irA(m.t)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors cursor-pointer hover:bg-white/[0.04] ${capActual === m ? "text-white" : "text-white/60"}`}>
              <span className="font-mono text-xs text-white/40 w-12 shrink-0">{formatoTiempo(m.t)}</span>
              <span className="flex-1">{m.label}</span>
              {capActual === m && <span className="w-1.5 h-1.5 rounded-full bg-lgb-red shrink-0" aria-label="Aquí vas" />}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
