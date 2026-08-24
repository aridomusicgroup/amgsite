"use client";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/shared/Reveal";
import { totalPlays, formatPlays } from "@/lib/works";

export function AridoAbout() {
  const { lang } = useLang();
  const plays = `${formatPlays(totalPlays())}+`;

  const stats =
    lang === "es"
      ? [
          { number: "50", label: "Beats activos" },
          { number: plays, label: "Reproducciones" },
          { number: "2K+", label: "Comunidad" },
          { number: "100%", label: "Mexicano" },
        ]
      : [
          { number: "50", label: "Active beats" },
          { number: plays, label: "Plays" },
          { number: "2K+", label: "Community" },
          { number: "100%", label: "Mexican" },
        ];

  const services =
    lang === "es"
      ? ["Producción", "Grabación", "Mezcla", "Master", "Letra", "Beats"]
      : ["Production", "Recording", "Mixing", "Mastering", "Songwriting", "Beats"];

  return (
    <section id="nosotros" className="py-24 px-6 max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        {/* Text side */}
        <Reveal>
          <p className="text-arido-red text-sm font-asphaltic tracking-[0.3em] uppercase mb-3">
            {lang === "es" ? "Quiénes somos" : "Who we are"}
          </p>
          <h2 className="text-5xl sm:text-6xl font-coolvetica text-[var(--fg)] leading-tight mb-6">
            {lang === "es" ? (
              <>
                Del desierto,
                <br />
                <span className="text-arido-red">para el mundo.</span>
              </>
            ) : (
              <>
                From the desert,
                <br />
                <span className="text-arido-red">to the world.</span>
              </>
            )}
          </h2>
          <p className="text-[var(--fg-2)] text-lg leading-relaxed mb-6">
            {lang === "es"
              ? "Árido Music Group es una casa productora 100% mexicana nacida en el altiplano potosino — tierra árida, de sol implacable y carácter fuerte. De ahí viene nuestro sonido y nuestro nombre."
              : "Árido Music Group is a 100% Mexican production house born in the Potosí highlands — arid land of relentless sun and strong character. That's where our sound and our name come from."}
          </p>
          <p className="text-[var(--fg-2)] text-lg leading-relaxed mb-10">
            {lang === "es"
              ? "Nos especializamos en regional mexicano: corridos tumbados, bélicos y sierreño. Producimos, grabamos, mezclamos y masterizamos con un objetivo: que tu música suene profesional y se sienta auténtica."
              : "We specialize in Mexican regional music: corridos tumbados, bélicos and sierreño. We produce, record, mix and master with one goal: making your music sound professional and feel authentic."}
          </p>

          <div className="grid grid-cols-2 gap-6">
            {stats.map((s) => (
              <div
                key={s.label}
                className="border border-[var(--border)] rounded-2xl p-5 bg-[var(--surface)] hover:border-arido-red/40 transition-colors"
              >
                <div className="text-4xl font-coolvetica text-arido-red mb-1">
                  {s.number}
                </div>
                <div className="text-sm text-[var(--fg-2)] uppercase tracking-wider">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Visual side */}
        <Reveal delay={150}>
          <div className="relative">
            <div className="absolute -inset-4 bg-arido-red/5 rounded-3xl blur-2xl" />
            <div className="relative rounded-3xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] p-8 flex flex-col gap-6">
              <blockquote className="text-3xl sm:text-4xl font-asphaltic text-[var(--fg)] leading-snug">
                &ldquo;The sound <span className="text-arido-red">hotter</span> than
                the sun.&rdquo;
              </blockquote>
              <p className="text-[var(--fg-2)]">— Árido Music Group 🌵</p>

              <div className="grid grid-cols-3 gap-3 mt-4">
                {services.map((service) => (
                  <span
                    key={service}
                    className="text-center text-xs py-2 px-3 rounded-full border border-[var(--border)] text-[var(--fg-2)] hover:border-arido-red hover:text-arido-red transition-colors cursor-default"
                  >
                    {service}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
