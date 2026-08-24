import type { Metadata } from "next";
import rawBeats from "@/data/beats-beatstars.json";
import { cleanTitle } from "@/lib/beatstars";
import { LGBNavbar } from "@/components/lgb/Navbar";
import { LGBHero } from "@/components/lgb/Hero";
import { BeatGrid } from "@/components/lgb/BeatGrid";
import { LicensesSection } from "@/components/lgb/LicensesSection";
import { FAQ } from "@/components/lgb/FAQ";
import { LGBFooter } from "@/components/lgb/Footer";

export const metadata: Metadata = {
  title: "Latino Gang Beats — Corridos Tumbados & Regional Mexicano Type Beats",
  description:
    "Compra beats de corridos tumbados, bélicos y regional mexicano. Type beats estilo Junior H, Peso Pluma, Fuerza Regida y más. Licencias desde $25 USD con entrega instantánea. By Árido Music Group 🌵",
  keywords: [
    "corridos tumbados type beat",
    "beats de corridos",
    "regional mexicano beats",
    "junior h type beat",
    "peso pluma type beat",
    "fuerza regida type beat",
    "comprar beats",
    "latino gang beats",
  ],
  alternates: { canonical: "https://beats.aridomusicgroup.com" },
  icons: {
    icon: "/icon-lgb.png",
    apple: "/apple-icon-lgb.png",
  },
  openGraph: {
    title: "Latino Gang Beats — Beats de Regional Mexicano",
    description:
      "Beats de corridos tumbados y regional mexicano. Licencias desde $25 USD. By Árido Music Group.",
    url: "https://beats.aridomusicgroup.com",
    siteName: "Latino Gang Beats",
    images: [{ url: "/og-lgb.png", width: 1200, height: 630 }],
    locale: "es_MX",
    type: "website",
  },
};

// Datos estructurados: catálogo de beats como ItemList de MusicRecording
const beatsJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Latino Gang Beats — Catálogo",
  numberOfItems: (rawBeats as Array<{ id: string }>).length,
  itemListElement: (
    rawBeats as Array<{ id: string; title: string; price?: number; beatstarsUrl?: string }>
  )
    .slice(0, 50)
    .map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "MusicRecording",
        name: cleanTitle(b.title),
        byArtist: { "@type": "MusicGroup", name: "Latino Gang Beats" },
        url: "https://beats.aridomusicgroup.com",
        offers: {
          "@type": "Offer",
          price: b.price ?? 25,
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
    })),
};

export default function BeatsPage() {
  return (
    <main className="bg-lgb-black min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(beatsJsonLd).replace(/</g, "\\u003c") }}
      />
      <LGBNavbar />
      <LGBHero />
      <BeatGrid />
      <LicensesSection />
      <FAQ />
      <LGBFooter />
    </main>
  );
}
