"use client";
import Image from "next/image";
import { useLang } from "@/lib/i18n";
import { TYPE_BEAT_ARTISTS } from "@/lib/site";
import { totalPlays, formatPlays } from "@/lib/works";

export function LGBHero() {
  const { lang } = useLang();

  const stats = [
    { n: "50", l: lang === "es" ? "Beats activos" : "Active beats" },
    { n: `${formatPlays(totalPlays())}+`, l: lang === "es" ? "Reproducciones" : "Plays" },
    { n: "4", l: lang === "es" ? "Tipos de licencia" : "License types" },
    { n: "24h", l: lang === "es" ? "Entrega inmediata" : "Instant delivery" },
  ];

  return (
    <section
      id="inicio"
      className="relative min-h-[80vh] flex flex-col items-center justify-center overflow-hidden bg-lgb-black"
    >
      {/* Scan lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)`,
        }}
      />

      {/* Glow blobs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-lgb-red/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-lgb-red/5 blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10 text-center px-6 pt-24 pb-10 w-full">
        <p className="text-lgb-red text-xs font-asphaltic tracking-[0.4em] uppercase mb-6">
          by Árido Music Group · México 🌵
        </p>

        <Image
          src="/logos/lgb-hero.png"
          alt="Latino Gang Beats"
          width={600}
          height={171}
          className="h-24 sm:h-32 lg:h-36 w-auto max-w-[90vw] mx-auto object-contain mb-8"
          priority
        />

        <p className="text-white/60 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          {lang === "es" ? (
            <>
              Beats de corridos tumbados, bélicos y regional mexicano para
              artistas que vienen por todo.
              <br />
              <span className="text-white/40 text-base">
                Licencias claras · Calidad de estudio · Hecho en el altiplano.
              </span>
            </>
          ) : (
            <>
              Corridos tumbados, bélico and Mexican regional type beats for
              artists coming for everything.
              <br />
              <span className="text-white/40 text-base">
                Clear licensing · Studio quality · Made in the Mexican highlands.
              </span>
            </>
          )}
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <a
            href="#catalogo"
            className="bg-lgb-red text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-red-700 transition-all hover:scale-105 active:scale-95"
          >
            {lang === "es" ? "Ver catálogo" : "Browse beats"}
          </a>
          <a
            href="#licencias"
            className="border border-white/20 text-white/70 px-8 py-3 rounded-full text-sm hover:border-white/50 hover:text-white transition-all"
          >
            {lang === "es" ? "Ver licencias" : "View licenses"}
          </a>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap justify-center gap-8 mt-16 pt-10 border-t border-white/5 max-w-3xl mx-auto">
          {stats.map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-2xl font-coolvetica text-white">{s.n}</div>
              <div className="text-xs text-white/40 mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Type beat artists marquee */}
      <div className="relative z-10 w-full overflow-hidden border-t border-white/5 py-4 bg-white/[0.02]">
        <div className="marquee flex gap-10 whitespace-nowrap">
          {[...TYPE_BEAT_ARTISTS, ...TYPE_BEAT_ARTISTS].map((artist, i) => (
            <span
              key={`${artist}-${i}`}
              className="text-white/25 font-asphaltic uppercase tracking-[0.2em] text-sm shrink-0"
            >
              {artist} <span className="text-lgb-red/40 ml-6">★</span>
            </span>
          ))}
        </div>
        <p className="sr-only">
          {lang === "es"
            ? "Type beats estilo Junior H, Peso Pluma, Fuerza Regida, Netón Vega y más"
            : "Type beats in the style of Junior H, Peso Pluma, Fuerza Regida, Netón Vega and more"}
        </p>
      </div>
    </section>
  );
}
