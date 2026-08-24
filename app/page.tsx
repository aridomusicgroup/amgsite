import type { Metadata } from "next";
import { AridoNavbar } from "@/components/arido/Navbar";
import { AridoHero } from "@/components/arido/Hero";
import { AridoAbout } from "@/components/arido/About";
import { AridoServices } from "@/components/arido/Services";
import { AridoWork } from "@/components/arido/Work";
import { LGBGateway } from "@/components/arido/LGBGateway";
import { AridoContact } from "@/components/arido/Contact";
import { AridoFooter } from "@/components/arido/Footer";

export const metadata: Metadata = {
  title: "Árido Music Group — Casa Productora de Regional Mexicano",
  description:
    "Casa productora 100% mexicana del altiplano potosino. Producción de corridos tumbados, grabación, mezcla, masterización y beats. The sound hotter than the sun. 🌵",
  keywords: [
    "casa productora regional mexicano",
    "producción de corridos",
    "corridos tumbados",
    "productor musical méxico",
    "arido music group",
    "latino gang beats",
    "mezcla y masterización",
  ],
  alternates: { canonical: "https://aridomusicgroup.com" },
  openGraph: {
    title: "Árido Music Group — The sound hotter than the sun",
    description:
      "Casa productora 100% mexicana de regional mexicano. Producción, grabación, mezcla y beats.",
    url: "https://aridomusicgroup.com",
    siteName: "Árido Music Group",
    images: [{ url: "/og-arido.png", width: 1200, height: 630 }],
    locale: "es_MX",
    type: "website",
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Árido Music Group",
  url: "https://aridomusicgroup.com",
  logo: "https://aridomusicgroup.com/icon-arido.png",
  description:
    "Casa productora 100% mexicana de regional mexicano: producción, grabación, mezcla, masterización y beats.",
  email: "latinogangbeats@gmail.com",
  telephone: "+52-488-178-0213",
  address: { "@type": "PostalAddress", addressRegion: "San Luis Potosí", addressCountry: "MX" },
  sameAs: [
    "https://www.instagram.com/aridomusicgroup/",
    "https://www.instagram.com/latinogangbeats/",
    "https://www.youtube.com/@LatinoGangBeats",
    "https://www.beatstars.com/latinogangbeats",
  ],
};

export default function Home() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd).replace(/</g, "\\u003c") }}
      />
      <AridoNavbar />
      <AridoHero />
      <AridoAbout />
      <AridoServices />
      <AridoWork />
      <LGBGateway />
      <AridoContact />
      <AridoFooter />
    </main>
  );
}
