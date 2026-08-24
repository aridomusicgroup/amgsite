"use client";
import { useLang } from "@/lib/i18n";
import { works, formatPlays } from "@/lib/works";
import { SOCIALS, DOMAINS } from "@/lib/site";

/**
 * Hero "Oro y noche" — dark luxury con el código visual del corrido.
 *
 * Tesis: el corrido es una balada NARRADA. La página se lee como la contraportada
 * de un disco: una declaración en serif de alto contraste y la obra como índice
 * tipografiado (no como reja de tarjetas, que es lo que hace todo el mundo).
 *
 * Disciplina: el oro entra solo como filete y una marca. Ni un degradado,
 * ni un glow, ni una sans geométrica en toda la página.
 */
export function HeroV2() {
  const { lang } = useLang();
  const es = lang === "es";

  // Las 6 de mayor alcance: el índice prueba, no presume.
  const indice = [...works].sort((a, b) => b.streams - a.streams).slice(0, 6);

  const nav = es
    ? [
        { label: "obra", href: "#obra" },
        { label: "beats", href: DOMAINS.beats },
        { label: "hablemos", href: SOCIALS.whatsapp },
      ]
    : [
        { label: "work", href: "#obra" },
        { label: "beats", href: DOMAINS.beats },
        { label: "talk", href: SOCIALS.whatsapp },
      ];

  return (
    <section className="v2-grain relative min-h-[100svh] flex flex-col bg-lgb-black text-lgb-white overflow-hidden">
      {/* Encabezado: nombre, tres puertas, y la procedencia como dato. */}
      <header className="v2-up relative z-10 flex items-center justify-between gap-4 px-5 sm:px-10 pt-7">
        <span className="v2-display text-xl sm:text-2xl tracking-[0.26em] uppercase">Árido</span>
        <nav className="v2-mono flex items-center gap-4 sm:gap-8 text-[10px] sm:text-[11px] tracking-[0.2em] uppercase">
          {nav.map((n) => (
            <a
              key={n.label}
              href={n.href}
              {...(n.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="pb-1 border-b border-transparent hover:border-lgb-gold hover:text-lgb-gold
                         focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lgb-gold transition-colors"
            >
              {n.label}
            </a>
          ))}
        </nav>
      </header>

      {/* La declaración. Serif de alto contraste, una sola palabra en oro. */}
      <div className="relative z-10 px-5 sm:px-10 pt-16 sm:pt-24 lg:pt-28">
        <p
          className="v2-mono v2-up text-[10px] sm:text-[11px] tracking-[0.32em] uppercase text-lgb-white/45 mb-7"
          style={{ animationDelay: "120ms" }}
        >
          {es ? "San Luis Potosí · México" : "San Luis Potosí · Mexico"}
        </p>

        <h1
          className="v2-display v2-up leading-[0.86] tracking-[-0.025em] max-w-[13ch]"
          style={{ fontSize: "clamp(3.4rem, 11.5vw, 9.5rem)", fontWeight: 900, animationDelay: "220ms" }}
        >
          {es ? (
            <>
              Del desierto,
              <br />
              <span className="text-lgb-gold italic">al mundo.</span>
            </>
          ) : (
            <>
              From the desert,
              <br />
              <span className="text-lgb-gold italic">to the world.</span>
            </>
          )}
        </h1>

        <div className="v2-rule v2-wipe mt-10 sm:mt-12 max-w-3xl" style={{ animationDelay: "460ms" }} />

        <div
          className="v2-up flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10 mt-6"
          style={{ animationDelay: "540ms" }}
        >
          <p className="v2-mono text-[10px] sm:text-[11px] tracking-[0.24em] uppercase text-lgb-white/55">
            {es ? "Producción · Grabación · Mezcla · Master" : "Production · Recording · Mixing · Master"}
          </p>
          <a
            href={SOCIALS.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="v2-display group inline-flex items-center gap-3 text-xl sm:text-2xl italic text-lgb-gold
                       hover:text-lgb-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lgb-gold
                       transition-colors self-start"
          >
            <span aria-hidden className="text-sm not-italic">◆</span>
            {es ? "Hablemos" : "Let's talk"}
          </a>
        </div>
      </div>

      {/* El índice: la obra como track listing, no como tarjetas. */}
      <div id="obra" className="relative z-10 px-5 sm:px-10 mt-auto pt-14 pb-8 sm:pb-10">
        <p
          className="v2-mono v2-up text-[10px] tracking-[0.3em] uppercase text-lgb-white/55 mb-3"
          style={{ animationDelay: "620ms" }}
        >
          {es ? "Salió de aquí" : "Came from here"}
        </p>

        <ul className="v2-up" style={{ animationDelay: "700ms" }}>
          {indice.map((w, i) => (
            <li key={`${w.title}-${i}`} className="v2-row">
              <a
                href={w.spotify || w.youtube || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="grid grid-cols-[2rem_1fr_auto] sm:grid-cols-[3rem_1fr_1fr_auto] items-baseline gap-3 sm:gap-6 py-3 sm:py-3.5
                           focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lgb-gold"
              >
                <span className="v2-idx v2-mono text-[10px] sm:text-xs text-lgb-white/45 tabular-nums transition-colors">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="v2-display text-base sm:text-xl truncate">{w.title}</span>
                <span className="v2-mono hidden sm:block text-[11px] tracking-wide uppercase text-lgb-white/60 truncate">
                  {w.artist}
                </span>
                <span className="v2-mono text-[10px] sm:text-xs text-lgb-white/55 tabular-nums whitespace-nowrap">
                  {formatPlays(w.streams)}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <a
          href={DOMAINS.beats}
          target="_blank"
          rel="noopener noreferrer"
          className="v2-mono v2-up inline-block mt-6 text-[10px] sm:text-[11px] tracking-[0.24em] uppercase
                     border-b border-lgb-gold/60 pb-1 hover:text-lgb-gold
                     focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lgb-gold transition-colors"
          style={{ animationDelay: "780ms" }}
        >
          {es ? "Catálogo de beats" : "Beat catalog"} →
        </a>
      </div>
    </section>
  );
}
