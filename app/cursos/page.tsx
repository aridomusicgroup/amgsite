import type { Metadata } from "next";
import { AridoNavbar } from "@/components/arido/Navbar";
import { AridoFooter } from "@/components/arido/Footer";
import { AridoCursos } from "@/components/arido/Cursos";
import { getCursosEnVenta } from "@/lib/cursos-publico";

// Igual que el inicio: estático y refrescado por el panel y las ventas.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Cursos en línea",
  description:
    "Aprende regional mexicano con el equipo de Árido Music Group: cursos en línea de docerola, requinto y más, a tu ritmo y con revisión personal.",
  alternates: { canonical: "https://aridomusicgroup.com/cursos" },
  openGraph: {
    title: "Cursos en línea — Árido Music Group",
    description: "Aprende regional mexicano con el equipo de Árido Music Group.",
    url: "https://aridomusicgroup.com/cursos",
    siteName: "Árido Music Group",
    images: [{ url: "/og-arido.png", width: 1200, height: 630 }],
    locale: "es_MX",
    type: "website",
  },
};

export default async function CursosPage() {
  const cursos = await getCursosEnVenta();
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <AridoNavbar />
      <AridoCursos cursos={cursos} pagina />
      <AridoFooter />
    </main>
  );
}
