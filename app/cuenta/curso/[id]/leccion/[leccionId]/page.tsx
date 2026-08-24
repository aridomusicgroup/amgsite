import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { getCursoDetalleCliente } from "@/lib/cursos-cliente";
import { LeccionViewer } from "@/components/cuenta/LeccionViewer";

export const metadata: Metadata = { title: "Lección — Árido Music Group", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string; leccionId: string }> };

export default async function LeccionPage({ params }: Props) {
  const email = await getCustomerEmail();
  if (!email) redirect("/cuenta/login");

  const { id, leccionId } = await params;
  const curso = await getCursoDetalleCliente(email, id);
  if (!curso) notFound();

  const leccion = curso.modulos.flatMap((m) => m.lecciones).find((l) => l.id === leccionId);
  if (!leccion) notFound();

  return (
    <main className="min-h-screen bg-lgb-black text-white">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Link href={`/cuenta/curso/${curso.id}`} className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-6 transition-colors w-fit">
          <ArrowLeft size={15} /> {curso.titulo}
        </Link>

        <h1 className="font-coolvetica text-2xl mb-5">{leccion.titulo}</h1>

        <LeccionViewer
          cursoId={curso.id}
          leccionId={leccion.id}
          tipo={leccion.tipo}
          urlExterna={leccion.urlExterna}
          vistoInicial={leccion.visto}
        />
      </div>
    </main>
  );
}
