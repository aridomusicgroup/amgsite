"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLang } from "@/lib/i18n";
import { DOMAINS } from "@/lib/site";

export function AridoHero() {
  const taglineRef = useRef<HTMLSpanElement>(null);
  const { lang } = useLang();

  useEffect(() => {
    const words = ["hotter", "louder", "rawer", "deeper"];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % words.length;
      if (taglineRef.current) taglineRef.current.textContent = words[i];
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background texture */}
      <div className="absolute inset-0 bg-[var(--bg)] transition-colors duration-300" />
      <div
        className="absolute inset-0 opacity-5 dark:opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23493c36' fill-opacity='1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Accent blobs */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-arido-red/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-arido-orange/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 flex flex-col items-center text-center pt-24 pb-16">
        <p className="text-arido-red text-sm font-asphaltic tracking-[0.3em] uppercase mb-8 animate-fade-in">
          {lang === "es"
            ? "Casa productora 100% mexicana 🌵"
            : "100% Mexican production house 🌵"}
        </p>

        {/* Logo completo como título */}
        <h1 className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <span className="sr-only">Árido Music Group</span>
          <span className="relative block">
            <span className="absolute inset-0 bg-arido-red/15 rounded-full blur-3xl scale-110 pointer-events-none" />
            <Image
              src="/logos/arido-color.png"
              alt="Árido Music Group"
              width={520}
              height={420}
              className="relative w-64 sm:w-80 lg:w-[420px] h-auto object-contain dark:hidden drop-shadow-2xl"
              priority
            />
            <Image
              src="/logos/arido-blanco.png"
              alt="Árido Music Group"
              width={520}
              height={420}
              className="relative w-64 sm:w-80 lg:w-[420px] h-auto object-contain hidden dark:block drop-shadow-2xl"
              priority
            />
          </span>
        </h1>

        <p
          className="text-xl sm:text-2xl font-asphaltic text-[var(--fg)] mt-10 mb-4 animate-slide-up"
          style={{ animationDelay: "0.2s" }}
        >
          The sound{" "}
          <span
            ref={taglineRef}
            className="text-arido-red transition-all duration-300"
          >
            hotter
          </span>{" "}
          than the sun.
        </p>

        <p
          className="text-[var(--fg-2)] text-base sm:text-lg mb-10 max-w-md animate-slide-up"
          style={{ animationDelay: "0.25s" }}
        >
          {lang === "es"
            ? "Te producimos, grabamos y mezclamos tu música — o llévate un beat ya. Regional mexicano con identidad, hecho en el altiplano potosino."
            : "We produce, record and mix your music — or grab a beat now. Mexican regional with identity, made in the Potosí highlands."}
        </p>

        <div
          className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up w-full sm:w-auto"
          style={{ animationDelay: "0.3s" }}
        >
          <a
            href={DOMAINS.beats}
            className="bg-arido-red text-white px-8 py-3 rounded-full font-medium hover:bg-arido-orange transition-all duration-300 hover:scale-105 active:scale-95 text-center"
          >
            {lang === "es" ? "Explorar Beats" : "Browse Beats"}
          </a>
          <Link
            href="#servicios"
            className="border-2 border-[var(--fg)] text-[var(--fg)] px-8 py-3 rounded-full font-medium hover:border-arido-red hover:text-arido-red transition-all duration-300 hover:scale-105 active:scale-95 text-center"
          >
            {lang === "es" ? "Nuestros servicios" : "Our services"}
          </Link>
        </div>
      </div>

      {/* Scroll indicator — solo desktop para no empalmarse en móvil */}
      <div className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 animate-bounce opacity-60 pointer-events-none">
        <span className="text-xs text-[var(--fg-2)] tracking-widest uppercase">
          Scroll
        </span>
        <div className="w-px h-8 bg-arido-red" />
      </div>
    </section>
  );
}
