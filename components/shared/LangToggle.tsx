"use client";
import { useLang } from "@/lib/i18n";

export function LangToggle({ variant = "arido" }: { variant?: "arido" | "lgb" }) {
  const { lang, setLang } = useLang();

  const base =
    variant === "lgb"
      ? "text-white/50 hover:text-white"
      : "text-[var(--fg-2)] hover:text-[var(--fg)]";
  const active = variant === "lgb" ? "text-white font-bold" : "text-arido-red font-bold";

  return (
    <button
      onClick={() => setLang(lang === "es" ? "en" : "es")}
      className={`flex items-center gap-1 text-xs tracking-wider cursor-pointer transition-colors ${base}`}
      aria-label="Cambiar idioma / Switch language"
    >
      <span className={lang === "es" ? active : ""}>ES</span>
      <span className="opacity-40">/</span>
      <span className={lang === "en" ? active : ""}>EN</span>
    </button>
  );
}
