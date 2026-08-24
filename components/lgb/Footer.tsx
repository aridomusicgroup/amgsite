"use client";
import Image from "next/image";

import { Music2, Mail, ExternalLink } from "lucide-react";
import { InstagramIcon, YoutubeIcon, TiktokIcon, WhatsappIcon } from "@/components/shared/BrandIcons";
import { useLang } from "@/lib/i18n";
import { SOCIALS, DOMAINS } from "@/lib/site";

export function LGBFooter() {
  const { lang } = useLang();

  const storeLinks = [
    { label: lang === "es" ? "Catálogo" : "Beats", href: "#catalogo" },
    { label: lang === "es" ? "Licencias" : "Licenses", href: "#licencias" },
    { label: "FAQ", href: "#faq" },
    { label: "BeatStars", href: SOCIALS.beatstars, external: true },
  ];

  return (
    <footer className="bg-lgb-black border-t border-white/5 text-lgb-white pb-24">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10 mb-10">
          <div>
            <Image
              src="/logos/lgb-blanco.png"
              alt="Latino Gang Beats"
              width={180}
              height={60}
              className="h-10 w-auto object-contain mb-4"
            />
            <p className="text-white/40 text-sm leading-relaxed max-w-xs mb-5">
              {lang === "es"
                ? "Beats de regional mexicano hechos en el altiplano potosino. Sub-marca de Árido Music Group. 🌵"
                : "Mexican regional beats made in the Potosí highlands. A sub-brand of Árido Music Group. 🌵"}
            </p>
            <div className="flex gap-3">
              {[
                { icon: WhatsappIcon, href: SOCIALS.whatsapp, label: "WhatsApp" },
                { icon: InstagramIcon, href: SOCIALS.instagramLGB, label: "Instagram" },
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
                  className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:border-lgb-red hover:text-lgb-red transition-colors"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-white/40 text-xs uppercase tracking-widest mb-4">
              {lang === "es" ? "Tienda" : "Store"}
            </h4>
            <ul className="flex flex-col gap-2">
              {storeLinks.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-1.5 text-white/50 hover:text-lgb-red text-sm transition-colors"
                  >
                    {item.label}
                    {item.external && <ExternalLink size={10} />}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white/40 text-xs uppercase tracking-widest mb-4">
              Árido Music Group
            </h4>
            <a
              href={DOMAINS.main}
              className="inline-flex items-center gap-2 text-white/50 hover:text-lgb-red text-sm transition-colors mb-3"
            >
              ← {lang === "es" ? "Volver a la casa productora" : "Back to the label"}
            </a>
            <p className="text-white/30 text-xs mt-4">
              © {new Date().getFullYear()} Latino Gang Beats · Árido Music Group.
              <br />
              {lang === "es"
                ? "Todos los derechos reservados."
                : "All rights reserved."}
            </p>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/20">
          <p>
            {lang === "es"
              ? "Los beats siguen siendo propiedad del productor hasta la compra de la licencia exclusiva."
              : "Beats remain property of the producer until an exclusive license is purchased."}
          </p>
          <p>
            {lang === "es" ? "Hecho con ♥ en México" : "Made with ♥ in Mexico"} 🇲🇽
          </p>
        </div>
      </div>
    </footer>
  );
}
