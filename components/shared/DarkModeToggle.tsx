"use client";
import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function DarkModeToggle({ variant = "arido" }: { variant?: "arido" | "lgb" }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  if (variant === "lgb") {
    return (
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className="relative w-12 h-6 rounded-full border border-white/20 bg-white/10 flex items-center transition-all duration-300 hover:border-[#c42f42]/60 cursor-pointer"
      >
        <span
          className={`absolute w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
            isDark
              ? "left-[2px] bg-lgb-red"
              : "left-[calc(100%-22px)] bg-lgb-white"
          }`}
        >
          {isDark ? (
            <Moon size={10} className="text-white" />
          ) : (
            <Sun size={10} className="text-lgb-black" />
          )}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="relative w-12 h-6 rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center transition-all duration-300 hover:border-arido-red/50 cursor-pointer"
    >
      <span
        className={`absolute w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
          isDark
            ? "left-[calc(100%-22px)] bg-arido-red"
            : "left-[2px] bg-arido-chocolate"
        }`}
      >
        {isDark ? (
          <Moon size={10} className="text-white" />
        ) : (
          <Sun size={10} className="text-arido-arena" />
        )}
      </span>
    </button>
  );
}
