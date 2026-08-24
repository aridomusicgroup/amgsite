"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { DarkModeToggle } from "@/components/shared/DarkModeToggle";
import { LangToggle } from "@/components/shared/LangToggle";
import { useLang } from "@/lib/i18n";
import { DOMAINS } from "@/lib/site";

export function AridoNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { lang } = useLang();

  const links = [
    { label: lang === "es" ? "Inicio" : "Home", href: "/#inicio" },
    { label: lang === "es" ? "Nosotros" : "About", href: "/#nosotros" },
    { label: lang === "es" ? "Servicios" : "Services", href: "/#servicios" },
    { label: lang === "es" ? "Nuestro trabajo" : "Our work", href: "/#trabajo" },
    { label: lang === "es" ? "Cotizador" : "Quote", href: "/cotizador" },
    { label: lang === "es" ? "Contacto" : "Contact", href: "/#contacto" },
    { label: "Beats", href: DOMAINS.beats },
  ];

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--nav-bg)] backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        {/* Logo: simplificado arriba, completo al hacer scroll */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          {scrolled ? (
            <>
              <Image
                src="/logos/arido-color.png"
                alt="Árido Music Group"
                width={120}
                height={48}
                className="h-10 w-auto object-contain dark:hidden"
                priority
              />
              <Image
                src="/logos/arido-blanco.png"
                alt="Árido Music Group"
                width={120}
                height={48}
                className="h-10 w-auto object-contain hidden dark:block"
                priority
              />
            </>
          ) : (
            <>
              <Image
                src="/logos/arido-icon.png"
                alt="Árido Music Group"
                width={48}
                height={48}
                className="h-10 w-auto object-contain dark:hidden"
                priority
              />
              <Image
                src="/logos/arido-icon-blanco.png"
                alt="Árido Music Group"
                width={48}
                height={48}
                className="h-10 w-auto object-contain hidden dark:block"
                priority
              />
            </>
          )}
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-6 text-sm font-medium">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`text-[var(--fg)] hover:text-arido-red transition-colors duration-200 ${
                  l.href === DOMAINS.beats
                    ? "bg-arido-red text-white px-4 py-1.5 rounded-full hover:bg-arido-orange hover:text-white"
                    : ""
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right: lang + dark mode + hamburger */}
        <div className="flex items-center gap-4">
          <LangToggle variant="arido" />
          <DarkModeToggle variant="arido" />
          <button
            className="md:hidden text-[var(--fg)] cursor-pointer"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 bg-[var(--nav-bg)] backdrop-blur-md ${
          open ? "max-h-96" : "max-h-0"
        }`}
      >
        <ul className="px-6 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                className="block text-[var(--fg)] hover:text-arido-red font-medium transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
