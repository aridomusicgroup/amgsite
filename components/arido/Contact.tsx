"use client";
import { Music2, Mail, ExternalLink } from "lucide-react";
import { InstagramIcon, YoutubeIcon, WhatsappIcon } from "@/components/shared/BrandIcons";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/shared/Reveal";
import { SOCIALS } from "@/lib/site";

export function AridoContact() {
  const { lang } = useLang();

  const channels = [
    {
      icon: WhatsappIcon,
      title: "WhatsApp",
      handle: SOCIALS.whatsappDisplay,
      note: lang === "es" ? "Escríbenos directo — cotización rápida" : "Message us directly — fast quote",
      href: SOCIALS.whatsapp,
      color: "#25D366",
    },
    {
      icon: InstagramIcon,
      title: "Instagram",
      handle: "@latinogangbeats",
      note: lang === "es" ? "Cotiza por DM — respuesta rápida" : "Get a quote via DM — fast reply",
      href: SOCIALS.instagramLGB,
      color: "#c42f42",
    },
    {
      icon: YoutubeIcon,
      title: "YouTube",
      handle: "@LatinoGangBeats",
      note: lang === "es" ? "Beats nuevos cada mes" : "New beats every month",
      href: SOCIALS.youtube,
      color: "#ea501e",
    },
    {
      icon: Music2,
      title: "BeatStars",
      handle: "latinogangbeats",
      note: lang === "es" ? "Catálogo completo y compra directa" : "Full catalog & direct purchase",
      href: SOCIALS.beatstars,
      color: "#d4af37",
    },
    {
      icon: Mail,
      title: "Email",
      handle: SOCIALS.email,
      note: lang === "es" ? "Proyectos y licencias exclusivas" : "Projects & exclusive licenses",
      href: `mailto:${SOCIALS.email}`,
      color: "#c42f42",
    },
  ];

  return (
    <section id="contacto" className="py-24 px-6 max-w-7xl mx-auto">
      <Reveal>
        <div className="text-center mb-14">
          <p className="text-arido-red text-sm font-asphaltic tracking-[0.3em] uppercase mb-3">
            {lang === "es" ? "Hablemos" : "Let's talk"}
          </p>
          <h2 className="text-5xl sm:text-6xl font-coolvetica text-[var(--fg)] leading-tight mb-4">
            {lang === "es" ? "Contacto" : "Contact"}
          </h2>
          <p className="text-[var(--fg-2)] max-w-xl mx-auto">
            {lang === "es"
              ? "¿Traes un corrido en mente? Trabajamos a distancia con artistas de todo México y el extranjero."
              : "Got a corrido in mind? We work remotely with artists across Mexico and abroad."}
          </p>
        </div>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {channels.map((c, i) => {
          const Icon = c.icon;
          return (
            <Reveal key={c.title} delay={i * 80}>
              <a
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="group block h-full rounded-2xl p-6 border border-[var(--border)] bg-[var(--surface)] hover:border-arido-red/50 transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${c.color}20` }}
                >
                  <Icon size={20} style={{ color: c.color }} />
                </div>
                <h3 className="font-coolvetica text-lg text-[var(--fg)] flex items-center gap-1.5">
                  {c.title}
                  <ExternalLink
                    size={11}
                    className="opacity-0 group-hover:opacity-60 transition-opacity"
                  />
                </h3>
                <p className="text-arido-red text-sm break-all">{c.handle}</p>
                <p className="text-[var(--fg-2)] text-xs mt-2">{c.note}</p>
              </a>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
