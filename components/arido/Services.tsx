"use client";
import { Mic2, Music2, Headphones, PenLine, Radio, Globe } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/shared/Reveal";
import { SOCIALS, DOMAINS } from "@/lib/site";

export function AridoServices() {
  const { lang } = useLang();

  const services =
    lang === "es"
      ? [
          {
            icon: Music2,
            title: "Producción Musical",
            description:
              "Producción completa de regional mexicano: corridos tumbados, bélicos, sierreño y más. Instrumentación real con identidad del altiplano.",
            color: "#c42f42",
          },
          {
            icon: Mic2,
            title: "Grabación",
            description:
              "Sesiones de grabación profesionales para capturar tu mejor toma. Voz, requinto, bajoloche y todo lo que tu corrido necesita.",
            color: "#ea501e",
          },
          {
            icon: Headphones,
            title: "Mezcla y Masterización",
            description:
              "Sonido competitivo y listo para plataformas. Tu tema con el punch y la claridad de un lanzamiento profesional.",
            color: "#d4af37",
          },
          {
            icon: PenLine,
            title: "Letra y Composición",
            description:
              "Te acompañamos en el proceso creativo: desde la idea hasta la letra terminada para tu tema.",
            color: "#c42f42",
          },
          {
            icon: Globe,
            title: "Servicios a Distancia",
            description:
              "Trabajamos con artistas de todo México y el extranjero. Cotiza por DM y recibe tu producción donde estés.",
            color: "#ea501e",
          },
          {
            icon: Radio,
            title: "Latino Gang Beats",
            description:
              "Nuestro catálogo de beats de regional mexicano. Licencias claras desde $25 USD con entrega instantánea.",
            color: "#d4af37",
            isLGB: true,
          },
        ]
      : [
          {
            icon: Music2,
            title: "Music Production",
            description:
              "Full Mexican regional production: corridos tumbados, bélicos, sierreño and more. Real instrumentation with highland identity.",
            color: "#c42f42",
          },
          {
            icon: Mic2,
            title: "Recording",
            description:
              "Professional recording sessions to capture your best take. Vocals, requinto, bajoloche and everything your corrido needs.",
            color: "#ea501e",
          },
          {
            icon: Headphones,
            title: "Mixing & Mastering",
            description:
              "Competitive, platform-ready sound. Your record with the punch and clarity of a professional release.",
            color: "#d4af37",
          },
          {
            icon: PenLine,
            title: "Songwriting",
            description:
              "We walk with you through the creative process: from the idea to the finished lyrics for your song.",
            color: "#c42f42",
          },
          {
            icon: Globe,
            title: "Remote Services",
            description:
              "We work with artists across Mexico and abroad. Get a quote via DM and receive your production wherever you are.",
            color: "#ea501e",
          },
          {
            icon: Radio,
            title: "Latino Gang Beats",
            description:
              "Our Mexican regional beat catalog. Clear licensing from $25 USD with instant delivery.",
            color: "#d4af37",
            isLGB: true,
          },
        ];

  return (
    <section id="servicios" className="py-24 bg-[var(--surface)]">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <div className="text-center mb-16">
            <p className="text-arido-red text-sm font-asphaltic tracking-[0.3em] uppercase mb-3">
              {lang === "es" ? "Lo que hacemos" : "What we do"}
            </p>
            <h2 className="text-5xl sm:text-6xl font-coolvetica text-[var(--fg)] leading-tight">
              {lang === "es" ? "Servicios" : "Services"}
            </h2>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => {
            const Icon = s.icon;
            const card = (
              <div
                className={`group relative h-full rounded-2xl p-6 border border-[var(--border)] bg-[var(--bg)] hover:border-arido-red/40 transition-all duration-300 hover:-translate-y-1 ${
                  s.isLGB ? "ring-1 ring-arido-red/20" : ""
                }`}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${s.color}20` }}
                >
                  <Icon size={22} style={{ color: s.color }} />
                </div>
                <h3 className="text-xl font-coolvetica text-[var(--fg)] mb-2">
                  {s.title}
                  {s.isLGB && (
                    <span className="ml-2 text-xs bg-arido-red text-white px-2 py-0.5 rounded-full font-sans">
                      STORE
                    </span>
                  )}
                </h3>
                <p className="text-[var(--fg-2)] text-sm leading-relaxed">
                  {s.description}
                </p>
              </div>
            );
            return (
              <Reveal key={s.title} delay={i * 70}>
                <a href={s.isLGB ? DOMAINS.beats : "/cotizador"}>{card}</a>
              </Reveal>
            );
          })}
        </div>

        <Reveal>
          <div className="text-center mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/cotizador"
              className="inline-flex items-center gap-2 bg-arido-red text-white px-8 py-3.5 rounded-full font-medium hover:bg-arido-orange transition-all duration-300 hover:scale-105 active:scale-95"
            >
              {lang === "es" ? "Arma tu paquete y cotiza al instante →" : "Build your package & get an instant quote →"}
            </a>
            <a
              href={SOCIALS.instagramLGB}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border-2 border-[var(--fg)] text-[var(--fg)] px-6 py-3 rounded-full text-sm font-medium hover:border-arido-red hover:text-arido-red transition-all duration-300"
            >
              {lang === "es" ? "O cotiza por DM 📩" : "Or quote via DM 📩"}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
