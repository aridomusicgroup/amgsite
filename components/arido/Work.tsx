"use client";
import Image from "next/image";
import { Play, Music2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/shared/Reveal";
import { works, featuredVideoId, totalPlays, formatPlays } from "@/lib/works";

export function AridoWork() {
  const { lang } = useLang();
  const total = totalPlays();

  return (
    <section id="trabajo" className="py-24 px-6 bg-lgb-black text-white">
      <div className="max-w-7xl mx-auto">
        <Reveal>
          <div className="text-center mb-12">
            <p className="text-lgb-red text-sm font-asphaltic tracking-[0.3em] uppercase mb-3">
              {lang === "es" ? "Discografía" : "Discography"}
            </p>
            <h2 className="text-5xl sm:text-6xl font-coolvetica leading-tight mb-4">
              {lang === "es" ? "Nuestro trabajo" : "Our work"}
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto">
              {lang === "es"
                ? "Beats y producciones que se volvieron canciones de artistas reales del regional mexicano."
                : "Beats and productions that became real songs by Mexican regional artists."}
            </p>
          </div>
        </Reveal>

        {/* Video destacado */}
        {featuredVideoId && (
          <Reveal>
            <div className="max-w-3xl mx-auto mb-14">
              <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-lgb-red/10 aspect-video bg-lgb-dark">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${featuredVideoId}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`}
                  title="ARIDO Music Group — 777"
                  allow="accelerated-encoding; autoplay; encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              <p className="text-center text-white/40 text-xs mt-3">
                {lang === "es"
                  ? "Reproduciéndose en silencio — sube el volumen ▶"
                  : "Playing muted — turn up the volume ▶"}
              </p>
            </div>
          </Reveal>
        )}

        {/* Galería de trabajos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-14">
          {works.map((w, i) => {
            const link = w.spotify || w.youtube;
            const Card = (
              <div className="group relative rounded-2xl overflow-hidden bg-lgb-surface border border-white/5 hover:border-lgb-red/40 transition-all duration-300 hover:-translate-y-1">
                <div className="relative aspect-square overflow-hidden">
                  {w.cover ? (
                    <Image
                      src={w.cover}
                      alt={`${w.title} — ${w.artist}`}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, 25vw"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a0508] to-lgb-red/30">
                      <Music2 size={28} className="text-white/30" />
                    </div>
                  )}
                  {link && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="w-12 h-12 rounded-full bg-lgb-red flex items-center justify-center shadow-lg shadow-lgb-red/50">
                        <Play size={18} className="text-white ml-0.5" />
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  <p className="font-coolvetica text-base leading-tight truncate">{w.title}</p>
                  <p className="text-white/40 text-xs truncate mt-0.5">{w.artist}</p>
                </div>
              </div>
            );
            return (
              <Reveal key={`${w.title}-${i}`} delay={i * 60}>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    {Card}
                  </a>
                ) : (
                  Card
                )}
              </Reveal>
            );
          })}
        </div>

        {/* Reproducciones totales */}
        <Reveal>
          <div className="text-center rounded-3xl border border-white/10 bg-gradient-to-br from-lgb-red/10 to-transparent py-10">
            <p className="text-white/50 text-sm uppercase tracking-widest mb-2">
              {lang === "es" ? "Reproducciones totales" : "Total streams"}
            </p>
            <p className="font-coolvetica text-6xl sm:text-7xl text-white">
              {formatPlays(total)}
              <span className="text-lgb-red">+</span>
            </p>
            <p className="text-white/40 text-sm mt-2">
              {lang === "es"
                ? "entre YouTube y BeatStars 🌵"
                : "across YouTube and BeatStars 🌵"}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
