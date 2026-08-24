"use client";
import Image from "next/image";
import { DOMAINS } from "@/lib/site";
import { ArrowRight, Music, Zap } from "lucide-react";
import rawBeats from "@/data/beats-beatstars.json";
import { cleanTitle, primaryGenre } from "@/lib/beatstars";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/shared/Reveal";

interface RawBeat {
  id: string;
  title: string;
  bpm: number;
  plays: number;
  genres: string[];
  artworkUrl?: string;
}

// Top 4 most played beats with artwork — real catalog preview
const topBeats = (rawBeats as RawBeat[])
  .filter((b) => b.artworkUrl)
  .sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))
  .slice(0, 4);

export function LGBGateway() {
  const { lang } = useLang();

  const genres = [
    "Corridos Tumbados",
    "Bélico",
    "Sierreño",
    "Regional Mexicano",
    "Type Beats",
  ];

  return (
    <section id="beats" className="py-24 px-6 max-w-7xl mx-auto">
      <Reveal>
        <div className="relative rounded-3xl overflow-hidden bg-lgb-black text-lgb-white">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-lgb-black via-[#1a0508] to-lgb-black" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-lgb-red/5 blur-3xl" />
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(255,255,255,0.03) 2px,
                rgba(255,255,255,0.03) 4px
              )`,
            }}
          />

          <div className="relative z-10 grid lg:grid-cols-2 gap-0">
            {/* Left: content */}
            <div className="p-10 sm:p-14 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-6">
                <Zap size={14} className="text-lgb-red" />
                <span className="text-lgb-red text-xs font-asphaltic tracking-[0.3em] uppercase">
                  {lang === "es"
                    ? "La tienda de beats de Árido"
                    : "Árido's beat store"}
                </span>
              </div>

              <Image
                src="/logos/lgb-blanco.png"
                alt="Latino Gang Beats"
                width={300}
                height={100}
                className="h-16 w-auto object-contain mb-6"
              />

              <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-md">
                {lang === "es"
                  ? "50 beats de regional mexicano listos para tu próximo corrido. Escucha, elige tu licencia y recibe tus archivos al instante."
                  : "50 Mexican regional beats ready for your next corrido. Listen, pick your license and get your files instantly."}
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="text-xs border border-white/20 text-white/60 px-3 py-1.5 rounded-full hover:border-lgb-red hover:text-lgb-red transition-colors"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <a
                href={DOMAINS.beats}
                className="group inline-flex items-center gap-3 bg-lgb-red text-white px-8 py-4 rounded-full font-medium hover:bg-red-700 transition-all duration-300 hover:scale-105 active:scale-95 w-fit"
              >
                <Music size={18} />
                {lang === "es" ? "Explorar el catálogo" : "Browse the catalog"}
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </a>
            </div>

            {/* Right: real top beats */}
            <div className="hidden lg:flex items-center justify-center p-10">
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                {topBeats.map((b) => (
                  <a
                    key={b.id}
                    href={DOMAINS.beats}
                    className="rounded-xl overflow-hidden aspect-square relative cursor-pointer hover:scale-105 transition-transform group/beat"
                  >
                    <Image
                      src={b.artworkUrl!}
                      alt={cleanTitle(b.title)}
                      fill
                      className="object-cover"
                      sizes="200px"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="text-white font-coolvetica text-sm leading-tight line-clamp-1">
                        {cleanTitle(b.title).split("|")[0].trim()}
                      </div>
                      <div className="text-white/60 text-xs mt-0.5">
                        {primaryGenre(b.genres)}
                        {b.bpm ? ` · ${b.bpm} BPM` : ""}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
