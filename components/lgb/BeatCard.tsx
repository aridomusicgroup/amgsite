"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Pause, ShoppingCart, ExternalLink } from "lucide-react";
import { Beat } from "@/lib/store";
import { usePlayerStore } from "@/lib/player";
import { useLang } from "@/lib/i18n";
import { slugify } from "@/lib/slug";

interface Props {
  beat: Beat;
  queue: Beat[];
  onBuyClick: (beat: Beat) => void;
}

export function BeatCard({ beat, queue, onBuyClick }: Props) {
  const [imgError, setImgError] = useState(false);
  const { current, isPlaying, play } = usePlayerStore();
  const { lang } = useLang();

  const isThisPlaying = current?.id === beat.id && isPlaying;
  const hasCover = beat.artworkUrl && !imgError;
  const playable = Boolean(beat.previewUrl || beat.hlsUrl);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playable) {
      play(beat, queue);
    } else if (beat.beatstarsUrl) {
      // Sin preview disponible: escuchar en BeatStars
      window.open(beat.beatstarsUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="group relative rounded-2xl overflow-hidden cursor-pointer bg-lgb-surface border border-white/5 hover:border-lgb-red/30 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:hover:-translate-y-1 hover:shadow-xl hover:shadow-lgb-red/10"
      onClick={() => onBuyClick(beat)}
    >
      {/* Cover art */}
      <div className="relative aspect-square overflow-hidden">
        {hasCover ? (
          <Image
            src={beat.artworkUrl!}
            alt={beat.title}
            fill
            className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${beat.coverGradient[0]}, ${beat.coverGradient[1]})`,
            }}
          />
        )}

        {/* Dark overlay on hover */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Shine sweep on hover */}
        <div className="pointer-events-none absolute inset-0 -translate-x-full motion-safe:group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Play button — siempre visible en móvil, hover en desktop */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
            isThisPlaying
              ? "opacity-100"
              : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
          }`}
        >
          <button
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-lgb-red flex items-center justify-center hover:bg-red-600 transition hover:scale-110 active:scale-95 cursor-pointer shadow-lg shadow-lgb-red/50"
            aria-label={isThisPlaying ? "Pause" : "Play"}
          >
            {isThisPlaying ? (
              <Pause size={20} className="text-white" />
            ) : (
              <Play size={20} className="text-white ml-0.5" />
            )}
          </button>
        </div>

        {/* Artist tag */}
        {beat.artists?.[0] && (
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white/80 text-[10px] px-2 py-0.5 rounded-full border border-white/10">
            {beat.artists[0]}
          </div>
        )}

        {/* Playing indicator */}
        {isThisPlaying && (
          <div className="absolute bottom-3 left-3 flex items-end gap-0.5 h-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-0.5 bg-lgb-red rounded-full animate-bounce"
                style={{ height: `${40 + i * 15}%`, animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <Link
          href={`/beat/${beat.slug ?? slugify(beat.title)}`}
          onClick={(e) => e.stopPropagation()}
          className="block"
          title={lang === "es" ? "Ver página del beat" : "View beat page"}
        >
          <h3 className="text-white hover:text-lgb-red font-coolvetica text-base leading-tight mb-1 line-clamp-2 min-h-[2.5rem] transition-colors">
            {beat.title}
          </h3>
        </Link>
        <div className="flex items-center gap-2 text-[11px] text-white/40 mb-3 flex-wrap">
          {beat.bpm > 0 && <span>{beat.bpm} BPM</span>}
          {beat.bpm > 0 && beat.key !== "—" && <span>·</span>}
          {beat.key !== "—" && <span>{beat.key}</span>}
          {beat.plays > 0 && (
            <>
              <span>·</span>
              <span>
                {beat.plays.toLocaleString()} {lang === "es" ? "plays" : "plays"}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-white font-coolvetica text-lg shrink-0">
            ${beat.price}
          </span>
          <div className="flex items-center gap-1.5">
            {beat.beatstarsUrl && (
              <a
                href={beat.beatstarsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-white/10 text-white/30 hover:text-white hover:border-white/30 transition-colors"
                title={lang === "es" ? "Ver en BeatStars" : "View on BeatStars"}
              >
                <ExternalLink size={11} />
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBuyClick(beat);
              }}
              className="flex items-center gap-1.5 bg-lgb-red/10 hover:bg-lgb-red text-lgb-red hover:text-white text-xs px-3 py-1.5 rounded-full border border-lgb-red/30 hover:border-lgb-red transition cursor-pointer"
            >
              <ShoppingCart size={11} />
              {lang === "es" ? "Comprar" : "Buy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
