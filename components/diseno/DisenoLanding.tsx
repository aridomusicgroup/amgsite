"use client";
import Image from "next/image";
import { Check, ArrowRight, ChevronDown } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/shared/Reveal";
import { WhatsappIcon } from "@/components/shared/BrandIcons";
import { SOCIALS } from "@/lib/site";
import { track } from "@/lib/track";
import { ahorroPaquete, type EjemploDiseno, type ServicioDisenoPublico } from "@/lib/diseno";

type Lang = "es" | "en";

const pesos = (n: number) => `$${n.toLocaleString("es-MX")} MXN`;
const wa = (texto: string) => `${SOCIALS.whatsapp}?text=${encodeURIComponent(texto)}`;

/** El precio como se lee en una tarjeta: "$450 MXN", "desde $150 MXN / pieza". */
function precioDe(s: ServicioDisenoPublico, lang: Lang): string {
  const base = pesos(s.precio);
  const unidad = s.unidad ? ` / ${s.unidad[lang]}` : "";
  return s.desde ? `${lang === "es" ? "desde" : "from"} ${base}${unidad}` : `${base}${unidad}`;
}

function mensajeDe(s: ServicioDisenoPublico, lang: Lang): string {
  return lang === "es"
    ? `Hola 👋 me interesa ${s.nombre.es} (${precioDe(s, "es")}) para mi lanzamiento.`
    : `Hi 👋 I'm interested in ${s.nombre.en} (${precioDe(s, "en")}) for my release.`;
}

/** Enlace a WhatsApp con el mensaje armado; cuenta el clic en PostHog. */
function Pedir({ servicio, lang, className, children }: {
  servicio: ServicioDisenoPublico | null; lang: Lang; className: string; children: React.ReactNode;
}) {
  const texto = servicio
    ? mensajeDe(servicio, lang)
    : lang === "es"
      ? "Hola 👋 quiero cotizar diseño para mi lanzamiento (portada, canvas o video)."
      : "Hi 👋 I'd like a quote for my release visuals (cover, canvas or video).";
  return (
    <a
      href={wa(texto)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("diseno_whatsapp", { servicio: servicio?.id ?? "general", precio: servicio?.precio ?? null })}
      className={className}
    >
      {children}
    </a>
  );
}

/** Los tres formatos que se entregan, dibujados a escala: la portada, el canvas y el visualizer. */
function Formatos({ lang }: { lang: Lang }) {
  const caja = "absolute rounded-xl border flex items-end p-3 text-[11px] uppercase tracking-[0.2em] font-asphaltic";
  return (
    <div className="relative w-full max-w-md aspect-square mx-auto" aria-hidden>
      <div className={`${caja} left-0 top-[14%] w-[62%] aspect-square border-white/15 bg-gradient-to-br from-lgb-red/25 via-[#1a0508] to-lgb-black text-white/70`}>
        1:1 · {lang === "es" ? "Portada" : "Cover"}
      </div>
      <div className={`${caja} right-[4%] top-0 w-[30%] aspect-[9/16] border-arido-orange/40 bg-gradient-to-b from-arido-orange/20 to-lgb-black text-arido-orange/90`}>
        9:16 · Canvas
      </div>
      <div className={`${caja} right-0 bottom-[2%] w-[58%] aspect-video border-lgb-gold/40 bg-gradient-to-r from-lgb-black to-lgb-gold/15 text-lgb-gold/90`}>
        16:9 · Visualizer
      </div>
    </div>
  );
}

function Paquete({ p, catalogo, lang }: { p: ServicioDisenoPublico; catalogo: ServicioDisenoPublico[]; lang: Lang }) {
  const ahorro = ahorroPaquete(p, catalogo);
  return (
    <div className={`relative h-full flex flex-col rounded-2xl p-6 border bg-lgb-surface transition-colors ${
      p.destacado ? "border-lgb-red/60" : "border-white/10 hover:border-white/25"}`}>
      {p.destacado && (
        <span className="absolute -top-3 left-6 text-[11px] bg-lgb-red text-white px-2.5 py-0.5 rounded-full">
          {lang === "es" ? "El más completo" : "Most complete"}
        </span>
      )}
      <h3 className="font-coolvetica text-2xl text-white">{p.nombre[lang]}</h3>
      <p className="font-coolvetica text-4xl text-white mt-3">{pesos(p.precio)}</p>
      {ahorro && (
        <p className="text-sm text-white/55 mt-1">
          {lang === "es" ? "Por separado" : "Separately"} <span className="line-through">{pesos(ahorro.separado)}</span>
          {" · "}<span className="text-green-300/90">{lang === "es" ? "ahorras" : "you save"} {pesos(ahorro.ahorro)}</span>
        </p>
      )}
      <ul className="mt-5 space-y-2 flex-1">
        {p.incluye[lang].map((x) => (
          <li key={x} className="flex gap-2 text-sm text-white/75">
            <Check size={16} className="text-lgb-red shrink-0 mt-0.5" /> {x}
          </li>
        ))}
      </ul>
      <Pedir servicio={p} lang={lang}
        className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all duration-300 active:scale-95 ${
          p.destacado ? "bg-lgb-red text-white hover:bg-arido-orange" : "border border-white/25 text-white hover:border-white/60"}`}>
        <WhatsappIcon size={16} /> {lang === "es" ? "Lo quiero" : "I want it"}
      </Pedir>
    </div>
  );
}

const PASOS: Record<Lang, { t: string; d: string }[]> = {
  es: [
    { t: "Cotiza", d: "Escríbenos por WhatsApp qué necesitas y para qué canción." },
    { t: "Anticipo y brief", d: "Nos mandas tu audio, letra, fotos y referencias." },
    { t: "Propuesta", d: "Recibes el diseño y tienes 1 ronda de cambios por pieza." },
    { t: "Entrega", d: "Todo en los formatos que piden Spotify, YouTube y redes." },
  ],
  en: [
    { t: "Get a quote", d: "Message us on WhatsApp with what you need and for which song." },
    { t: "Deposit & brief", d: "Send us your audio, lyrics, photos and references." },
    { t: "Proposal", d: "You get the design with 1 round of changes per piece." },
    { t: "Delivery", d: "Everything in the formats Spotify, YouTube and socials ask for." },
  ],
};

const FAQS: Record<Lang, { q: string; a: string }[]> = {
  es: [
    { q: "¿Cuántos cambios incluye?", a: "Una ronda de cambios por pieza. Si necesitas más, te cotizamos la ronda extra antes de hacerla." },
    { q: "¿Cuánto tarda?", a: "Depende del servicio; te damos fecha al recibir tu material completo. Si tienes prisa, hay entrega urgente en 24 o 48 horas." },
    { q: "¿Tengo que haber producido con ustedes?", a: "No. Cualquier artista puede pedir su diseño. Si tu tema sí salió de aquí, lo ligamos a tu proyecto." },
    { q: "¿Puedo pagar en dólares?", a: "Sí. Te mandamos la cotización en USD; los pagos internacionales llevan una comisión de 7% por la plataforma de cobro." },
  ],
  en: [
    { q: "How many changes are included?", a: "One round of changes per piece. If you need more, we quote the extra round before doing it." },
    { q: "How long does it take?", a: "It depends on the service; we give you a date once we have all your material. In a rush? Add 24 or 48-hour delivery." },
    { q: "Do I need to have produced with you?", a: "No. Any artist can order. If your song was made here, we link it to your project." },
    { q: "Can I pay in dollars?", a: "Yes. We send the quote in USD; international payments carry a 7% fee from the payment platform." },
  ],
};

export function DisenoLanding({ servicios, ejemplos }: { servicios: ServicioDisenoPublico[]; ejemplos: EjemploDiseno[] }) {
  const { lang } = useLang();
  const paquetes = servicios.filter((s) => s.grupo === "paquete");
  const sueltos = servicios.filter((s) => s.grupo === "servicio");
  const extras = servicios.filter((s) => s.grupo === "adicional");
  const etiqueta = "text-sm font-asphaltic tracking-[0.3em] uppercase mb-3";

  return (
    <>
      {/* Hero + paquetes: bloque oscuro de vitrina, como "Nuestro trabajo". */}
      <section className="bg-lgb-black text-white pt-32 pb-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <p className={`text-lgb-red ${etiqueta}`}>{lang === "es" ? "Diseño visual" : "Visual design"}</p>
            <h1 className="font-coolvetica text-5xl sm:text-7xl leading-[0.95]">
              {lang === "es" ? "Tu canción también entra por los ojos" : "Your song deserves to be seen"}
            </h1>
            <p className="text-white/60 text-lg mt-5 max-w-xl">
              {lang === "es"
                ? "Portada, canvas, visualizer y lyric video listos para plataformas. Todo pensado para que tu lanzamiento se vea al nivel de cómo suena."
                : "Cover art, canvas, visualizer and lyric video, platform-ready. Built so your release looks as good as it sounds."}
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a href="#paquetes" className="inline-flex items-center gap-2 bg-lgb-red text-white px-7 py-3.5 rounded-full font-medium hover:bg-arido-orange transition-all duration-300 hover:scale-105 active:scale-95">
                {lang === "es" ? "Ver paquetes" : "See packages"} <ArrowRight size={16} />
              </a>
              <Pedir servicio={null} lang={lang}
                className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-3.5 rounded-full text-sm font-medium hover:border-white/70 transition-colors">
                <WhatsappIcon size={16} /> {lang === "es" ? "Cotizar por WhatsApp" : "Quote on WhatsApp"}
              </Pedir>
            </div>
          </Reveal>
          <Reveal delay={120}><Formatos lang={lang} /></Reveal>
        </div>

        <div id="paquetes" className="max-w-7xl mx-auto mt-24 scroll-mt-24">
          <Reveal>
            <h2 className="font-coolvetica text-4xl sm:text-5xl text-center mb-12">
              {lang === "es" ? "Paquetes para tu lanzamiento" : "Release packages"}
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {paquetes.map((p, i) => (
              <Reveal key={p.id} delay={i * 80} className="h-full">
                <Paquete p={p} catalogo={servicios} lang={lang} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Servicios sueltos + extras */}
      <section className="py-24 px-4 sm:px-6 bg-[var(--bg)]">
        <div className="max-w-7xl mx-auto">
          <Reveal>
            <p className={`text-arido-red text-center ${etiqueta}`}>{lang === "es" ? "Por pieza" : "À la carte"}</p>
            <h2 className="font-coolvetica text-4xl sm:text-5xl text-[var(--fg)] text-center mb-12">
              {lang === "es" ? "Servicios sueltos" : "Individual services"}
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sueltos.map((s, i) => (
              <Reveal key={s.id} delay={(i % 4) * 60} className="h-full">
                <div className="h-full flex flex-col rounded-2xl p-5 border border-[var(--border)] bg-[var(--surface)] hover:border-arido-red/40 transition-colors">
                  <h3 className="font-coolvetica text-xl text-[var(--fg)]">{s.nombre[lang]}</h3>
                  <p className="font-coolvetica text-lg text-[var(--fg)] mt-1">{precioDe(s, lang)}</p>
                  <p className="text-[var(--fg-2)] text-sm leading-relaxed mt-3 flex-1">{s.incluye[lang].join(" · ")}</p>
                  <Pedir servicio={s} lang={lang}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--fg)] hover:text-arido-red transition-colors w-fit">
                    {lang === "es" ? "Pedir" : "Order"} <ArrowRight size={14} />
                  </Pedir>
                </div>
              </Reveal>
            ))}
          </div>

          {extras.length > 0 && (
            <Reveal>
              <div className="mt-10 rounded-2xl border border-[var(--border)] p-5 sm:p-6 max-w-3xl mx-auto">
                <h3 className="font-coolvetica text-2xl text-[var(--fg)] mb-3">{lang === "es" ? "Extras" : "Add-ons"}</h3>
                <ul className="grid sm:grid-cols-2 gap-x-8">
                  {extras.map((x) => (
                    <li key={x.id} className="flex justify-between gap-4 py-2 border-b border-[var(--border)] text-sm">
                      <span className="text-[var(--fg-2)]">{x.nombre[lang]}</span>
                      <span className="text-[var(--fg)] font-medium whitespace-nowrap">+ {pesos(x.precio)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {ejemplos.length > 0 && (
        <section className="py-20 px-4 sm:px-6 bg-lgb-black">
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {ejemplos.map((e) => (
              <div key={e.src} className="relative aspect-square rounded-2xl overflow-hidden border border-white/10">
                <Image src={e.src} alt={e.alt} fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ¿Producimos tu tema? */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--surface)]">
        <Reveal>
          <div className="max-w-4xl mx-auto rounded-3xl border border-arido-red/30 bg-[var(--bg)] p-8 sm:p-12 text-center">
            <h2 className="font-coolvetica text-3xl sm:text-5xl text-[var(--fg)]">
              {lang === "es" ? "¿Tu tema salió de ARIDO?" : "Was your song made at ARIDO?"}
            </h2>
            <p className="text-[var(--fg-2)] mt-4 max-w-2xl mx-auto leading-relaxed">
              {lang === "es"
                ? "Ligamos tu portada, canvas y video a tu proyecto: trabajamos con tu master final y tu fecha de salida para que todo llegue junto. Y si pagas de contado, tu descuento de cliente frecuente también aplica aquí."
                : "We link your cover, canvas and video to your project: we work from your final master and release date so everything lands together. Pay in full and your returning-client discount applies here too."}
            </p>
            <a
              href={wa(lang === "es"
                ? "Hola 👋 ya grabé mi tema con ustedes y quiero cotizar el diseño (portada, canvas o video)."
                : "Hi 👋 I recorded my song with you and I'd like a quote for the visuals (cover, canvas or video).")}
              target="_blank" rel="noopener noreferrer"
              onClick={() => track("diseno_whatsapp", { servicio: "cliente_arido", precio: null })}
              className="mt-7 inline-flex items-center gap-2 bg-arido-red text-white px-7 py-3.5 rounded-full font-medium hover:bg-arido-orange transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <WhatsappIcon size={16} /> {lang === "es" ? "Ya grabé con ustedes" : "I recorded with you"}
            </a>
          </div>
        </Reveal>
      </section>

      {/* Cómo funciona + preguntas */}
      <section className="py-24 px-4 sm:px-6 bg-[var(--bg)]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="font-coolvetica text-4xl sm:text-5xl text-[var(--fg)] text-center mb-12">
              {lang === "es" ? "Cómo funciona" : "How it works"}
            </h2>
          </Reveal>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PASOS[lang].map((p, i) => (
              <Reveal key={p.t} delay={i * 70}>
                <li className="list-none">
                  <span className="font-coolvetica text-5xl text-arido-red">{i + 1}</span>
                  <h3 className="font-coolvetica text-xl text-[var(--fg)] mt-2">{p.t}</h3>
                  <p className="text-[var(--fg-2)] text-sm mt-1 leading-relaxed">{p.d}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          <div className="mt-20 max-w-3xl mx-auto">
            <Reveal>
              <h2 className="font-coolvetica text-3xl sm:text-4xl text-[var(--fg)] mb-6">
                {lang === "es" ? "Preguntas" : "Questions"}
              </h2>
            </Reveal>
            {FAQS[lang].map((f) => (
              <details key={f.q} className="group border-b border-[var(--border)] py-4">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-[var(--fg)] font-medium">
                  {f.q}
                  <ChevronDown size={18} className="shrink-0 text-[var(--fg-2)] transition-transform group-open:rotate-180" />
                </summary>
                <p className="text-[var(--fg-2)] text-sm leading-relaxed mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
