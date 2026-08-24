"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/shared/Reveal";
import { SOCIALS } from "@/lib/site";

const FAQS = {
  es: [
    {
      q: "¿Cómo recibo mi beat después de comprar?",
      a: "La compra se procesa de forma segura a través de BeatStars: al pagar, recibes al instante los archivos y tu contrato de licencia en PDF por email. Sin esperas.",
    },
    {
      q: "¿Qué diferencia hay entre las licencias?",
      a: "Cambian los archivos que recibes (MP3, WAV o stems) y los límites de uso: copias distribuidas, streams, videos musicales y estaciones de radio. La Exclusiva retira el beat de la venta y te da uso ilimitado.",
    },
    {
      q: "¿Las licencias son exclusivas?",
      a: "Basic, Premium y Premium Plus son licencias no exclusivas: el beat sigue a la venta y el productor conserva los derechos de autor. Si quieres el beat solo para ti, negocia la Licencia Exclusiva.",
    },
    {
      q: "¿Puedo subir mi tema a Spotify y YouTube?",
      a: "Sí. Todas las licencias permiten distribución en plataformas digitales dentro de los límites de streams de cada licencia. Recuerda acreditar: 'Prod. Latino Gang Beats'.",
    },
    {
      q: "¿Hacen beats personalizados o producción completa?",
      a: "Sí — somos casa productora. Producción a la medida, grabación, mezcla, master y hasta apoyo con la letra. Cotiza por DM en Instagram o por email.",
    },
  ],
  en: [
    {
      q: "How do I receive my beat after purchase?",
      a: "Checkout is processed securely through BeatStars: after paying you instantly receive the files and your license agreement PDF by email. No waiting.",
    },
    {
      q: "What's the difference between licenses?",
      a: "They differ in the files you get (MP3, WAV or stems) and usage limits: distributed copies, streams, music videos and radio stations. The Exclusive removes the beat from sale and gives you unlimited use.",
    },
    {
      q: "Are the licenses exclusive?",
      a: "Basic, Premium and Premium Plus are non-exclusive: the beat stays on sale and the producer keeps the copyright. If you want the beat all to yourself, negotiate the Exclusive License.",
    },
    {
      q: "Can I upload my song to Spotify and YouTube?",
      a: "Yes. All licenses allow digital distribution within each license's stream limits. Remember to credit: 'Prod. Latino Gang Beats'.",
    },
    {
      q: "Do you make custom beats or full production?",
      a: "Yes — we're a production house. Custom production, recording, mixing, mastering and even songwriting support. Get a quote via Instagram DM or email.",
    },
  ],
};

export function FAQ() {
  const { lang } = useLang();
  const [open, setOpen] = useState<number | null>(0);
  const faqs = FAQS[lang];

  return (
    <section id="faq" className="py-20 px-4 sm:px-8 bg-lgb-black">
      <div className="max-w-3xl mx-auto">
        <Reveal>
          <div className="text-center mb-10">
            <p className="text-lgb-red text-xs font-asphaltic tracking-[0.3em] uppercase mb-3">
              FAQ
            </p>
            <h2 className="text-4xl sm:text-5xl font-coolvetica text-white">
              {lang === "es" ? "Preguntas Frecuentes" : "Frequently Asked Questions"}
            </h2>
          </div>
        </Reveal>

        <div className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <div className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer hover:bg-white/3 transition-colors"
                >
                  <span className="text-white font-coolvetica text-base">{f.q}</span>
                  <ChevronDown
                    size={16}
                    className={`text-lgb-red shrink-0 transition-transform duration-300 ${
                      open === i ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-all duration-300 ${
                    open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-white/50 text-sm leading-relaxed">{f.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="text-center text-white/30 text-sm mt-8">
            {lang === "es" ? "¿Más dudas? Escríbenos: " : "More questions? Write to us: "}
            <a
              href={`mailto:${SOCIALS.email}`}
              className="text-lgb-red hover:text-red-400 transition-colors"
            >
              {SOCIALS.email}
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
