"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, ShoppingCart, ArrowLeft, User } from "lucide-react";
import { LangToggle } from "@/components/shared/LangToggle";
import { useCartStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { DOMAINS } from "@/lib/site";
import { LGBCart } from "./Cart";

export function LGBNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { items, toggleCart, isOpen } = useCartStore();
  const { lang } = useLang();

  const links = [
    { label: lang === "es" ? "Inicio" : "Home", href: "#inicio" },
    { label: lang === "es" ? "Catálogo" : "Beats", href: "#catalogo" },
    { label: lang === "es" ? "Licencias" : "Licenses", href: "#licencias" },
    { label: "FAQ", href: "#faq" },
  ];

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-lgb-black/95 backdrop-blur-md border-b border-white/5"
            : "bg-transparent"
        }`}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          {/* Back to ARIDO */}
          <a
            href={DOMAINS.main}
            className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs transition-colors mr-4 shrink-0"
          >
            <ArrowLeft size={12} />
            <span className="hidden sm:inline">Árido Music Group</span>
          </a>

          {/* Logo simplificado LGB */}
          <a href={DOMAINS.beats} className="flex items-center shrink-0">
            <Image
              src="/logos/lgb-icon-nav.png"
              alt="Latino Gang Beats"
              width={82}
              height={36}
              className="h-6 w-auto object-contain"
              priority
            />
          </a>

          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-6 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Right */}
          <div className="flex items-center gap-4 ml-4">
            <LangToggle variant="lgb" />
            <a
              href={`${DOMAINS.main}/cuenta`}
              className="text-white/70 hover:text-white transition-colors"
              aria-label={lang === "es" ? "Mi cuenta" : "My account"}
              title={lang === "es" ? "Mi cuenta" : "My account"}
            >
              <User size={19} />
            </a>
            <button
              onClick={toggleCart}
              className="relative text-white/70 hover:text-white transition-colors cursor-pointer"
              aria-label={lang === "es" ? "Carrito" : "Cart"}
            >
              <ShoppingCart size={20} />
              {items.length > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 bg-lgb-red rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                  {items.length}
                </span>
              )}
            </button>
            <button
              className="md:hidden text-white cursor-pointer"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 bg-lgb-black border-b border-white/5 ${
            mobileOpen ? "max-h-64" : "max-h-0"
          }`}
        >
          <ul className="px-6 py-4 flex flex-col gap-4">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-white/70 hover:text-white transition-colors"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </header>

      {/* Cart drawer */}
      {isOpen && <LGBCart />}
    </>
  );
}
