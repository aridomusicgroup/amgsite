import type { Metadata } from "next";
import { AridoNavbar } from "@/components/arido/Navbar";
import { AridoFooter } from "@/components/arido/Footer";
import { Quoter } from "@/components/arido/Quoter";
import { QuoterHeader } from "@/components/arido/QuoterHeader";

export const metadata: Metadata = {
  title: "Cotizador — Arma tu producción",
  description:
    "Arma tu paquete de producción de regional mexicano: beat personalizado, instrumentos extra, mezcla y master. Cotiza al instante y paga en línea. Latino Gang Beats · Árido Music Group.",
  alternates: { canonical: "https://aridomusicgroup.com/cotizador" },
  openGraph: {
    title: "Cotizador — Árido Music Group",
    description:
      "Arma tu paquete de producción y cotiza al instante. Paquetes Tumbes, Alucines, Empedes y más.",
    url: "https://aridomusicgroup.com/cotizador",
    images: [{ url: "/og-arido.png", width: 1200, height: 630 }],
    locale: "es_MX",
    type: "website",
  },
};

export default function CotizadorPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AridoNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-28 pb-24">
        <QuoterHeader />
        <Quoter />
      </div>
      <AridoFooter />
    </main>
  );
}
