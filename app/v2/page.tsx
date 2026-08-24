import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono } from "next/font/google";
import { HeroV2 } from "@/components/arido/v2/Hero";

// next/font descarga y auto-hospeda las fuentes en build: quedan como 'self' y
// el CSP (font-src 'self') no las bloquea. Sin peticiones a Google en runtime.
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-v2",
  display: "swap",
});

// Ruta de validación del rediseño. Convive con el sitio actual (/) para
// comparar en local. No se indexa mientras sea borrador.
export const metadata: Metadata = {
  title: "Árido — rediseño (borrador)",
  robots: { index: false, follow: false },
};

export default function V2Page() {
  return (
    <main className={`${display.variable} ${mono.variable}`}>
      <HeroV2 />
    </main>
  );
}
