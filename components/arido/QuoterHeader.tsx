"use client";
import { useLang } from "@/lib/i18n";

export function QuoterHeader() {
  const { lang } = useLang();
  return (
    <div className="text-center mb-12">
      <p className="text-arido-red text-sm font-asphaltic tracking-[0.3em] uppercase mb-3">
        {lang === "es" ? "Cotizador" : "Quote builder"}
      </p>
      <h1 className="text-5xl sm:text-6xl font-coolvetica text-[var(--fg)] leading-tight mb-4">
        {lang === "es" ? "Arma tu producción" : "Build your production"}
      </h1>
      <p className="text-[var(--fg-2)] max-w-xl mx-auto">
        {lang === "es"
          ? "Elige un paquete o empieza desde cero, personalízalo a tu gusto y conoce el precio al instante. Sin vueltas."
          : "Pick a package or start from scratch, customize it your way and see the price instantly. No back-and-forth."}
      </p>
    </div>
  );
}
