"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Square, Repeat, Timer, Loader2, AlertCircle } from "lucide-react";

/* alphaTab se carga como script estático desde /public/alphatab (ver
   scripts/copy-alphatab.mjs): sólo en esta pantalla y sin pasar por el bundler.
   Estos tipos cubren únicamente lo que usamos de su API. */
interface AtEvent<T> { on: (fn: (v: T) => void) => void }
interface AtStaff { tuning?: unknown[]; isPercussion?: boolean; showTablature: boolean; showStandardNotation: boolean }
interface AtTrack { index: number; name: string; staves: AtStaff[] }
interface AtScore { title: string; tracks: AtTrack[] }
interface AtApi {
  scoreLoaded: AtEvent<AtScore>;
  playerReady: AtEvent<void>;
  playerStateChanged: AtEvent<{ state: number }>;
  renderFinished: AtEvent<void>;
  error: AtEvent<unknown>;
  load: (data: Uint8Array) => boolean;
  playPause: () => void;
  stop: () => void;
  playbackSpeed: number;
  isLooping: boolean;
  metronomeVolume: number;
  countInVolume: number;
  changeTrackMute: (tracks: AtTrack[], mute: boolean) => void;
  score: AtScore | null;
  render: () => void;
  destroy: () => void;
}
interface AlphaTabGlobal {
  AlphaTabApi: new (el: HTMLElement, settings: unknown) => AtApi;
}

/**
 * Qué se dibuja de cada pentagrama. Se ajusta en el modelo y no con el perfil
 * de alphaTab porque muchos archivos (MusicXML, algunos Guitar Pro) traen la
 * partitura apagada y el perfil no la vuelve a encender. Lo que no tiene
 * cuerdas (voz, percusión) siempre va en partitura.
 */
function aplicarVista(api: AtApi, soloTab: boolean) {
  for (const t of api.score?.tracks ?? []) {
    for (const s of t.staves) {
      const conTab = (s.tuning?.length ?? 0) > 0 && !s.isPercussion;
      s.showTablature = conTab;
      s.showStandardNotation = !soloTab || !conTab;
    }
  }
}

const BASE = "/alphatab";
let cargando: Promise<AlphaTabGlobal> | null = null;

function cargarAlphaTab(): Promise<AlphaTabGlobal> {
  const w = window as unknown as { alphaTab?: AlphaTabGlobal };
  if (w.alphaTab) return Promise.resolve(w.alphaTab);
  cargando ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${BASE}/alphaTab.min.js`;
    s.async = true;
    s.onload = () => (w.alphaTab ? resolve(w.alphaTab) : reject(new Error("alphaTab no cargó")));
    s.onerror = () => { cargando = null; reject(new Error("alphaTab no cargó")); };
    document.head.appendChild(s);
  });
  return cargando;
}

const VELOCIDADES = [0.25, 0.5, 0.75, 1];

/**
 * Tablatura / partitura que SUENA: se toca a la velocidad que quieras, se
 * repite la selección (arrastra sobre los compases), trae metrónomo y cuenta
 * de entrada, y se puede silenciar cada instrumento para tocar encima.
 */
export function TabInteractiva({ src }: { src: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<AtApi | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [listoAudio, setListoAudio] = useState(false);
  const [tocando, setTocando] = useState(false);
  const [vel, setVel] = useState(1);
  const [loop, setLoop] = useState(false);
  const [metronomo, setMetronomo] = useState(false);
  const [soloTab, setSoloTab] = useState(true);
  const [pistas, setPistas] = useState<AtTrack[]>([]);
  const [mudas, setMudas] = useState<Set<number>>(new Set());

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [at, res] = await Promise.all([cargarAlphaTab(), fetch(src)]);
        if (!res.ok) throw new Error("archivo");
        const datos = new Uint8Array(await res.arrayBuffer());
        if (!vivo || !hostRef.current) return;
        // URLs absolutas: el worker de alphaTab corre desde un Blob y ahí una ruta
        // relativa no resuelve (importScripts falla con "URL is invalid").
        const raiz = `${window.location.origin}${BASE}`;
        const api = new at.AlphaTabApi(hostRef.current, {
          // (Carga diferida de fábrica: con `enableLazyLoading: false` el cambio a
          // partitura dejaba encimado el dibujo anterior.)
          core: { fontDirectory: `${raiz}/font/`, scriptFile: `${raiz}/alphaTab.min.js` },
          display: { scale: 0.9 },
          player: {
            enablePlayer: true,
            enableUserInteraction: true,
            enableCursor: true,
            soundFont: `${raiz}/soundfont/sonivox.sf2`,
            scrollElement: scrollRef.current ?? undefined,
          },
        });
        apiRef.current = api;
        api.scoreLoaded.on((score) => {
          aplicarVista(api, true); // empieza en tablatura: es lo que lee la mayoría
          if (vivo) { setPistas(score.tracks); setEstado("listo"); }
        });
        api.renderFinished.on(() => vivo && setEstado("listo"));
        api.playerReady.on(() => vivo && setListoAudio(true));
        api.playerStateChanged.on((e) => vivo && setTocando(e.state === 1));
        api.error.on(() => vivo && setEstado("error"));
        api.load(datos);
      } catch {
        if (vivo) setEstado("error");
      }
    })();
    return () => { vivo = false; apiRef.current?.destroy(); apiRef.current = null; };
  }, [src]);

  // Los manejadores leen la API del ref al momento del clic (no durante el render).
  const conApi = (fn: (api: AtApi) => void) => { if (apiRef.current) fn(apiRef.current); };
  const cambiarVel = (v: number) => { setVel(v); conApi((api) => { api.playbackSpeed = v; }); };
  const cambiarLoop = () => { const n = !loop; setLoop(n); conApi((api) => { api.isLooping = n; }); };
  const cambiarMetronomo = () => {
    const n = !metronomo;
    setMetronomo(n);
    conApi((api) => { api.metronomeVolume = n ? 1 : 0; api.countInVolume = n ? 1 : 0; });
  };
  const cambiarVista = () => {
    const n = !soloTab;
    setSoloTab(n);
    conApi((api) => { aplicarVista(api, n); api.render(); });
  };
  const mutear = (t: AtTrack) => {
    const n = new Set(mudas);
    const muda = !n.has(t.index);
    if (muda) n.add(t.index); else n.delete(t.index);
    setMudas(n);
    conApi((api) => api.changeTrackMute([t], muda));
  };

  const chip = (activo: boolean) =>
    `inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 ${activo ? "bg-lgb-red text-white" : "bg-white/8 text-white/70 hover:text-white"}`;

  if (estado === "error") {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-white/10 p-4 text-sm text-white/60">
        <AlertCircle size={16} className="text-red-400 shrink-0" /> No se pudo abrir la tablatura. Recarga la página o avísanos por WhatsApp.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Controles de la tablatura">
        <button onClick={() => conApi((api) => api.playPause())} disabled={!listoAudio} className={chip(tocando)} aria-label={tocando ? "Pausa" : "Reproducir"}>
          {!listoAudio ? <Loader2 size={13} className="animate-spin" /> : tocando ? <Pause size={13} /> : <Play size={13} />}
          {tocando ? "Pausa" : "Tocar"}
        </button>
        <button onClick={() => conApi((api) => api.stop())} disabled={!listoAudio} className={chip(false)} aria-label="Detener"><Square size={12} /></button>
        <span className="w-px h-5 bg-white/10 mx-1" aria-hidden />
        {VELOCIDADES.map((v) => (
          <button key={v} onClick={() => cambiarVel(v)} className={chip(vel === v)} aria-pressed={vel === v}>{v * 100}%</button>
        ))}
        <span className="w-px h-5 bg-white/10 mx-1" aria-hidden />
        <button onClick={cambiarLoop} className={chip(loop)} aria-pressed={loop} title="Arrastra sobre los compases para elegir qué repetir"><Repeat size={13} /> Repetir</button>
        <button onClick={cambiarMetronomo} className={chip(metronomo)} aria-pressed={metronomo}><Timer size={13} /> Metrónomo</button>
        <button onClick={cambiarVista} className={chip(!soloTab)} aria-pressed={!soloTab}>{soloTab ? "Ver partitura" : "Sólo tablatura"}</button>
      </div>

      {pistas.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-white/50">Silenciar:</span>
          {pistas.map((t) => (
            <button key={t.index} onClick={() => mutear(t)} className={chip(mudas.has(t.index))} aria-pressed={mudas.has(t.index)}>
              {t.name || `Pista ${t.index + 1}`}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-white/40">Toca un compás para empezar ahí; arrastra sobre varios y activa “Repetir” para practicarlos en loop.</p>

      <div ref={scrollRef} className="relative max-h-[70vh] overflow-auto rounded-2xl bg-white scroll-sutil">
        {estado === "cargando" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-black/50 gap-2">
            <Loader2 size={16} className="animate-spin" /> Cargando tablatura…
          </div>
        )}
        <div ref={hostRef} className="min-h-[240px] text-black" />
      </div>
    </div>
  );
}
