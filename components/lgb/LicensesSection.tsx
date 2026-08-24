"use client";
import { Check, Star, Sparkles } from "lucide-react";
import rawLicenses from "@/data/licenses.json";
import { License } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/shared/Reveal";

const licenses = rawLicenses as License[];

export function LicensesSection() {
  const { lang } = useLang();

  return (
    <section id="licencias" className="py-20 px-4 sm:px-8 bg-lgb-dark">
      <div className="max-w-7xl mx-auto">
        <Reveal>
          <div className="text-center mb-12">
            <p className="text-lgb-red text-xs font-asphaltic tracking-[0.3em] uppercase mb-3">
              {lang === "es" ? "Precios" : "Pricing"}
            </p>
            <h2 className="text-4xl sm:text-5xl font-coolvetica text-white mb-3">
              {lang === "es" ? "Tipos de Licencia" : "License Types"}
            </h2>
            <p className="text-white/40 max-w-lg mx-auto text-sm">
              {lang === "es"
                ? "Elige la licencia que se adapte a tu proyecto. Los mismos términos y precios que en nuestro BeatStars oficial."
                : "Pick the license that fits your project. Same terms and prices as our official BeatStars store."}
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {licenses.map((lic, i) => (
            <Reveal key={lic.id} delay={i * 80}>
              <div
                className={`relative h-full rounded-2xl p-6 border transition-all hover:-translate-y-1 ${
                  lic.popular
                    ? "border-lgb-red bg-lgb-red/5"
                    : lic.exclusive
                      ? "border-lgb-gold/40 bg-lgb-gold/5"
                      : "border-white/10 bg-white/3 hover:border-white/20"
                }`}
              >
                {lic.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-lgb-red text-white text-[10px] px-3 py-1 rounded-full tracking-wider uppercase">
                    {lang === "es" ? "Más Popular" : "Most Popular"}
                  </div>
                )}
                {lic.exclusive && (
                  <>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-lgb-gold text-black text-[10px] font-medium px-3 py-1 rounded-full tracking-wider uppercase whitespace-nowrap">
                      {lang === "es" ? "Única · solo 1" : "Unique · only 1"}
                    </div>
                    <Star
                      size={14}
                      className="absolute top-4 right-4 text-lgb-gold fill-lgb-gold"
                    />
                  </>
                )}

                <div
                  className="text-[10px] font-asphaltic tracking-widest uppercase mb-3"
                  style={{ color: lic.color }}
                >
                  {lic.badge}
                </div>

                <h3 className="text-white font-coolvetica text-xl mb-1">
                  {lic.name[lang]}
                </h3>
                <p className="text-white/40 text-xs mb-4">{lic.description[lang]}</p>

                <div className="text-3xl font-coolvetica text-white mb-6">
                  {lic.price !== null ? (
                    <>
                      ${lic.price}
                      <span className="text-white/30 text-sm font-sans ml-1">USD</span>
                    </>
                  ) : (
                    <span className="text-lgb-gold text-2xl">
                      {lang === "es" ? "Negociable" : "Negotiable"}
                    </span>
                  )}
                </div>

                <ul className="flex flex-col gap-2 mb-6">
                  {lic.features[lang].slice(0, 6).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-white/60">
                      <Check size={11} className="text-green-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                  {lic.features[lang].length > 6 && (
                    <li className="text-xs text-white/30 pl-5">
                      +{lic.features[lang].length - 6} {lang === "es" ? "más..." : "more..."}
                    </li>
                  )}
                </ul>

                <a
                  href="#catalogo"
                  className="block w-full text-center py-2.5 rounded-full text-sm border transition-all hover:scale-105 active:scale-95"
                  style={{
                    borderColor: lic.popular ? "#c42f42" : lic.exclusive ? "#d4af37" : "rgba(255,255,255,0.15)",
                    backgroundColor: lic.popular ? "#c42f42" : "transparent",
                    color: lic.exclusive ? "#d4af37" : "white",
                  }}
                >
                  {lang === "es" ? "Elegir un beat" : "Pick a beat"}
                </a>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Aviso genérico, sin datos personales — el nivel real solo se ve en
            /cuenta, ya identificado. Aquí es puro gancho. */}
        <Reveal delay={200}>
          <div className="mt-8 flex items-center justify-center gap-2.5 text-center rounded-2xl border border-amber-400/15 bg-amber-500/[0.04] px-5 py-3.5 max-w-xl mx-auto">
            <Sparkles size={15} className="text-amber-300 shrink-0" />
            <p className="text-white/60 text-xs">
              {lang === "es"
                ? "Entre más compras completas, mejor precio en tus próximos proyectos a la medida."
                : "The more purchases you complete, the better price on your next custom projects."}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
