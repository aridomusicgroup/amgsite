import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { getCursoDetalleCliente } from "@/lib/cursos-cliente";
import { ETIQUETA_DE } from "@/lib/cursos-tipos";
import { LeccionViewer } from "@/components/cuenta/curso/LeccionViewer";
import { NotasLeccion } from "@/components/cuenta/curso/NotasLeccion";
import { CtaLeccion } from "@/components/cuenta/curso/CtaLeccion";

export const metadata: Metadata = { title: "Lección — Árido Music Group", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string; leccionId: string }> };

export default async function LeccionPage({ params }: Props) {
  const email = await getCustomerEmail();
  if (!email) redirect("/cuenta/login");

  const { id, leccionId } = await params;
  const curso = await getCursoDetalleCliente(email, id);
  if (!curso) notFound();

  const todas = curso.modulos.flatMap((m) => m.lecciones.map((l) => ({ l, modulo: m.titulo })));
  const i = todas.findIndex((x) => x.l.id === leccionId);
  // Lección que ya no existe, no publicada o curso en preventa: al inicio del curso.
  if (i < 0) redirect(`/cuenta/curso/${curso.id}`);
  const { l: leccion, modulo } = todas[i];
  const anterior = todas[i - 1]?.l ?? null;
  const siguiente = todas[i + 1]?.l ?? null;
  const et = ETIQUETA_DE[leccion.etiqueta];
  // La revisión incluida se usa en la primera entrega de evaluación del curso.
  const entrega = todas.find((x) => x.l.tipo === "entrega")?.l ?? null;
  const m = curso.config.mentoria;

  return (
    <main className="min-h-screen bg-lgb-black text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-5 py-8">
        <Link href={`/cuenta/curso/${curso.id}`} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-6 transition-colors w-fit">
          <ArrowLeft size={15} /> {curso.titulo}
        </Link>

        <p className="text-[11px] uppercase tracking-wider text-white/50 mb-1">
          {modulo} · {et?.emoji} {et?.label}{leccion.opcional ? " · opcional" : ""}
        </p>
        <h1 className="font-coolvetica text-2xl sm:text-3xl mb-5">{leccion.titulo}</h1>

        <div className="flex flex-col gap-6">
          <LeccionViewer cursoId={curso.id} leccion={leccion} />
          <NotasLeccion cursoId={curso.id} leccionId={leccion.id} notas={leccion.notas} recursos={leccion.recursos} />
          <CtaLeccion
            cta={leccion.cta}
            texto={leccion.ctaTexto}
            cursoId={curso.id}
            leccionId={leccion.id}
            cursoTitulo={curso.titulo}
            entregaHref={entrega && entrega.id !== leccion.id ? `/cuenta/curso/${curso.id}/leccion/${entrega.id}` : null}
            mentoria={{ estado: m.estado, cursoId: m.curso_id, precioMes: m.precio_mes, esMiembro: curso.esMiembro }}
          />
        </div>

        <nav className="grid grid-cols-2 gap-3 mt-10" aria-label="Lecciones">
          {anterior ? (
            <Link href={`/cuenta/curso/${curso.id}/leccion/${anterior.id}`} className="flex items-center gap-2 rounded-2xl border border-white/8 px-4 py-3 hover:border-white/20 transition-colors min-w-0">
              <ChevronLeft size={16} className="shrink-0 text-white/50" />
              <span className="min-w-0"><span className="block text-[11px] text-white/50">Anterior</span><span className="block text-sm truncate">{anterior.titulo}</span></span>
            </Link>
          ) : <span />}
          {siguiente && (
            <Link href={`/cuenta/curso/${curso.id}/leccion/${siguiente.id}`} className="flex items-center justify-end gap-2 rounded-2xl border border-white/8 px-4 py-3 hover:border-white/20 transition-colors text-right min-w-0">
              <span className="min-w-0"><span className="block text-[11px] text-white/50">Siguiente</span><span className="block text-sm truncate">{siguiente.titulo}</span></span>
              <ChevronRight size={16} className="shrink-0 text-white/50" />
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
