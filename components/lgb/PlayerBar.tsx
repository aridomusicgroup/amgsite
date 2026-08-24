"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type HlsType from "hls.js";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  ShoppingCart,
} from "lucide-react";
import { usePlayerStore } from "@/lib/player";
import { useLang } from "@/lib/i18n";
import { Beat } from "@/lib/store";
import { track } from "@/lib/track";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function PlayerBar({ onBuyClick }: { onBuyClick?: (beat: Beat) => void }) {
  const { current, isPlaying, setPlaying, next, prev, close } = usePlayerStore();
  const { lang } = useLang();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<HlsType | null>(null);
  const srcRef = useRef<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Embudo: arranque del preview de un beat (top del funnel de la tienda)
  useEffect(() => {
    if (current) track("preview_play", { beat_id: current.id, beat: current.title });
    // solo cuando cambia el beat, no en resume/pause
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Single shared <audio> element driven by the global store
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.volume = 0.85;
      audioRef.current = audio;
      audio.addEventListener("timeupdate", () => setProgress(audio.currentTime));
      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("ended", () => usePlayerStore.getState().next());
    }
    return () => {
      audioRef.current?.pause();
      hlsRef.current?.destroy();
    };
  }, []);

  // React to beat changes — MP3 directo o HLS (hls.js / nativo en Safari)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const load = async () => {
      if (!current) {
        audio.pause();
        return;
      }
      const src = current.previewUrl ?? current.hlsUrl ?? null;
      if (!src) {
        audio.pause();
        return;
      }

      if (srcRef.current !== src) {
        srcRef.current = src;
        setProgress(0);
        setDuration(0);
        hlsRef.current?.destroy();
        hlsRef.current = null;

        if (src.endsWith(".m3u8")) {
          // hls.js primero: el "maybe" nativo de Chrome no es confiable
          const { default: Hls } = await import("hls.js");
          if (Hls.isSupported()) {
            const hls = new Hls();
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(audio);
          } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
            audio.src = src; // Safari/iOS nativo
          }
        } else {
          audio.src = src;
        }
      }

      if (usePlayerStore.getState().isPlaying) {
        audio.play().catch(() => setPlaying(false));
      } else {
        audio.pause();
      }
    };

    load();
  }, [current, isPlaying, setPlaying]);

  if (!current) return null;

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[80] bg-lgb-black/95 backdrop-blur-lg border-t border-white/10 animate-slide-up">
      {/* Seek bar */}
      <div className="h-1.5 bg-white/10 cursor-pointer group" onClick={seek}>
        <div
          className="h-full bg-lgb-red relative transition-[width] duration-150"
          style={{ width: duration ? `${(progress / duration) * 100}%` : "0%" }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-lgb-red opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-3 sm:gap-5">
        {/* Cover + title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {current.artworkUrl ? (
            <Image
              src={current.artworkUrl}
              alt={current.title}
              width={44}
              height={44}
              className="w-11 h-11 rounded-lg object-cover shrink-0"
              unoptimized
            />
          ) : (
            <div
              className="w-11 h-11 rounded-lg shrink-0"
              style={{
                background: `linear-gradient(135deg, ${current.coverGradient?.[0] ?? "#1a0508"}, ${current.coverGradient?.[1] ?? "#c42f42"})`,
              }}
            />
          )}
          <div className="min-w-0">
            <p className="text-white text-sm font-coolvetica truncate">
              {current.title}
            </p>
            <p className="text-white/40 text-[11px] truncate">
              {current.artists?.[0] ?? current.genre}
              {current.bpm > 0 && ` · ${current.bpm} BPM`}
              {current.key !== "—" && ` · ${current.key}`}
              <span className="hidden sm:inline">
                {" "}· {fmt(progress)} / {fmt(duration)}
              </span>
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={prev}
            className="text-white/50 hover:text-white p-1.5 cursor-pointer transition-colors"
            aria-label={lang === "es" ? "Anterior" : "Previous"}
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={() => setPlaying(!isPlaying)}
            className="w-10 h-10 rounded-full bg-lgb-red flex items-center justify-center text-white hover:bg-red-600 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-lgb-red/40"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
          </button>
          <button
            onClick={next}
            className="text-white/50 hover:text-white p-1.5 cursor-pointer transition-colors"
            aria-label={lang === "es" ? "Siguiente" : "Next"}
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* Buy + close */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onBuyClick?.(current)}
            className="hidden sm:flex items-center gap-1.5 bg-white/5 hover:bg-lgb-red text-white/80 hover:text-white text-xs px-4 py-2 rounded-full border border-white/15 hover:border-lgb-red transition-all cursor-pointer"
          >
            <ShoppingCart size={12} />
            {current.price ? `$${current.price}` : lang === "es" ? "Comprar" : "Buy"}
          </button>
          <button
            onClick={close}
            className="text-white/30 hover:text-white p-1.5 cursor-pointer transition-colors"
            aria-label={lang === "es" ? "Cerrar reproductor" : "Close player"}
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
