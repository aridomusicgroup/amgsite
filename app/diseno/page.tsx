import type { Metadata } from "next";
import { AridoNavbar } from "@/components/arido/Navbar";
import { AridoFooter } from "@/components/arido/Footer";
import { DisenoLanding } from "@/components/diseno/DisenoLanding";
import { catalogoDisenoPublico, ejemplosDiseno } from "@/lib/diseno-catalogo";

const URL = "https://aridomusicgroup.com/diseno";

export const metadata: Metadata = {
  title: "Diseño visual para artistas — Portada, canvas y video",
  description:
    "Portada (cover art), canvas de Spotify, visualizer para YouTube, lyric video, logo y branding para tu lanzamiento. Paquetes desde $1,050 MXN. Árido Music Group.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Diseño visual para artistas — Árido Music Group",
    description: "Portada, canvas, visualizer y lyric video listos para plataformas. Paquetes para tu lanzamiento.",
    url: URL,
    images: [{ url: "/og-arido.png", width: 1200, height: 630 }],
    locale: "es_MX",
    type: "website",
  },
};

export default function DisenoPage() {
  // Sin el costo del diseñador: esto viaja al navegador.
  const servicios = catalogoDisenoPublico();
  const catalogoJsonLd = {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Diseño visual para artistas",
    url: URL,
    itemListElement: servicios.map((s) => ({
      "@type": "Offer",
      price: s.precio,
      priceCurrency: "MXN",
      itemOffered: { "@type": "Service", name: s.nombre.es, provider: { "@type": "Organization", name: "Árido Music Group" } },
    })),
  };

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(catalogoJsonLd).replace(/</g, "\\u003c") }}
      />
      <AridoNavbar />
      <DisenoLanding servicios={servicios} ejemplos={ejemplosDiseno()} />
      <AridoFooter />
    </main>
  );
}
