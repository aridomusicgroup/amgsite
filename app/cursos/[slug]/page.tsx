import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCursoPublico } from "@/lib/cursos-publico";
import { VentaCurso } from "@/components/cursos/VentaCurso";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCursoPublico(slug);
  if (!c) return { title: "Curso — Árido Music Group" };
  return {
    title: `${c.titulo} — Curso en línea | Árido Music Group`,
    description: c.descripcion ?? undefined,
    openGraph: { title: c.titulo, description: c.descripcion ?? undefined, images: c.portadaUrl ? [c.portadaUrl] : undefined },
  };
}

export default async function CursoVentaPage({ params }: Props) {
  const { slug } = await params;
  const c = await getCursoPublico(slug);
  if (!c) notFound();
  return <VentaCurso c={c} />;
}
