import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        arido: {
          chocolate: "#493c36",
          arena: "#dfd4c0",
          beige: "#c0ae98",
          red: "#c42f42",
          orange: "#ea501e",
          dark: "#1a1008",
          "dark-surface": "#2a1e14",
        },
        lgb: {
          black: "#0a0a0a",
          dark: "#111111",
          surface: "#1a1a1a",
          red: "#c42f42",
          gold: "#d4af37",
          white: "#f0f0f0",
        },
      },
      fontFamily: {
        coolvetica: ["Coolvetica", "sans-serif"],
        asphaltic: ["Asphaltic Grain", "serif"],
        sans: ["var(--font-geist-sans)", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "slide-up": "slideUp 0.7s ease-out forwards",
        "slide-in-left": "slideInLeft 0.7s ease-out forwards",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "spin-slow": "spin 4s linear infinite",
        "bounce-slow": "bounce 3s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(196,47,66,0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(196,47,66,0.8)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
