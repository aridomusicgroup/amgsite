"use client";
import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";
import { InstagramIcon, YoutubeIcon, TiktokIcon, WhatsappIcon } from "@/components/shared/BrandIcons";
import { useLang } from "@/lib/i18n";
import { SOCIALS, DOMAINS } from "@/lib/site";

export function AridoFooter() {
  const { lang } = useLang();

  const navLinks = [
    { label: lang === "es" ? "Inicio" : "Home", href: "#inicio" },
    { label: lang === "es" ? "Nosotros" : "About", href: "#nosotros" },
    { label: lang === "es" ? "Servicios" : "Services", href: "#servicios" },
    { label: lang === "es" ? "Contacto" : "Contact", href: "#contacto" },
  ];

  const lgbLinks = [
    { label: lang === "es" ? "Catálogo" : "Catalog", href: `${DOMAINS.beats}/#catalogo` },
    { label: lang === "es" ? "Licencias" : "Licenses", href: `${DOMAINS.beats}/#licencias` },
    { label: "FAQ", href: `${DOMAINS.beats}/#faq` },
    { label: "BeatStars", href: SOCIALS.beatstars, external: true },
  ];

  return (
    <footer className="bg-arido-chocolate text-arido-arena">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Image
              src="/logos/arido-blanco.png"
              alt="Árido Music Group"
              width={160}
              height={64}
              className="h-12 w-auto object-contain mb-4"
            />
            <p className="text-arido-beige text-sm leading-relaxed max-w-xs mb-6">
              {lang === "es"
                ? "Casa productora 100% mexicana de regional mexicano, nacida en el altiplano potosino. The sound hotter than the sun. 🌵"
                : "100% Mexican regional music production house, born in the Potosí highlands. The sound hotter than the sun. 🌵"}
            </p>
            <div className="flex gap-3">
              {[
                { icon: WhatsappIcon, href: SOCIALS.whatsapp, label: "WhatsApp" },
                { icon: InstagramIcon, href: SOCIALS.instagramArido, label: "Instagram" },
                { icon: YoutubeIcon, href: SOCIALS.youtube, label: "YouTube" },
                { icon: TiktokIcon, href: SOCIALS.tiktok, label: "TikTok" },
                { icon: Mail, href: `mailto:${SOCIALS.email}`, label: "Email" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-full border border-arido-beige/30 flex items-center justify-center hover:border-arido-red hover:text-arido-red transition-colors"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-asphaltic tracking-wider uppercase text-xs mb-4 text-arido-beige">
              {lang === "es" ? "Navegación" : "Navigation"}
            </h4>
            <ul className="flex flex-col gap-2">
              {navLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-arido-beige/70 hover:text-arido-red transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* LGB */}
          <div>
            <h4 className="font-asphaltic tracking-wider uppercase text-xs mb-4 text-arido-beige">
              Latino Gang Beats
            </h4>
            <ul className="flex flex-col gap-2">
              {lgbLinks.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-arido-beige/70 hover:text-arido-red transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-arido-beige/10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-arido-beige/50">
            © {new Date().getFullYear()} Árido Music Group.{" "}
            {lang === "es"
              ? "Todos los derechos reservados."
              : "All rights reserved."}
          </p>
          <p className="text-xs text-arido-beige/50">
            {lang === "es"
              ? "Hecho con ♥ en el altiplano potosino"
              : "Made with ♥ in the Potosí highlands"}{" "}
            🇲🇽
          </p>
        </div>
      </div>
    </footer>
  );
}
