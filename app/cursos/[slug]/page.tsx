import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCursoPublico } from "@/lib/cursos-publico";
import { VentaCurso } from "@/components/cursos/VentaCurso";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCursoPublico(slug);
  if (!c) return { title: "Curso" };
  const titulo = c.venta.estado === "preventa" ? `${c.titulo} — Preventa` : c.titulo;
  // La imagen para compartir la genera opengraph-image.tsx (con precio y lugares).
  return {
    title: `${titulo} — Curso en línea`,
    description: c.descripcion ?? undefined,
    alternates: { canonical: `https://aridomusicgroup.com/cursos/${c.slug}` },
    openGraph: { title: titulo, description: c.descripcion ?? undefined, url: `https://aridomusicgroup.com/cursos/${c.slug}`, siteName: "Árido Music Group", locale: "es_MX", type: "website" },
    twitter: { card: "summary_large_image", title: titulo, description: c.descripcion ?? undefined },
  };
}

export default async function CursoVentaPage({ params }: Props) {
  const { slug } = await params;
  const c = await getCursoPublico(slug);
  if (!c) notFound();
  return <VentaCurso c={c} />;
}
