import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Video, FileText, Link2, Check } from "lucide-react";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { getCursoDetalleCliente } from "@/lib/cursos-cliente";

export const metadata: Metadata = { title: "Mi curso — Árido Music Group", robots: { index: false } };
export const dynamic = "force-dynamic";

const TIPO_ICON = { video: Video, pdf: FileText, link: Link2 };

type Props = { params: Promise<{ id: string }> };

export default async function CursoClientePage({ params }: Props) {
  const email = await getCustomerEmail();
  if (!email) redirect("/cuenta/login");

  const { id } = await params;
  const curso = await getCursoDetalleCliente(email, id);
  if (!curso) notFound();

  return (
    <main className="min-h-screen bg-lgb-black text-white">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <Link href="/cuenta" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-6 transition-colors w-fit">
          <ArrowLeft size={15} /> Mi cuenta
        </Link>

        <h1 className="font-coolvetica text-3xl mb-1">{curso.titulo}</h1>
        {curso.descripcion && <p className="text-white/40 text-sm mb-4">{curso.descripcion}</p>}

        <div className="flex items-center gap-2 mb-8">
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-lgb-red rounded-full" style={{ width: `${curso.pct}%` }} />
          </div>
          <span className="text-white/40 text-xs shrink-0">{curso.pct}%</span>
        </div>

        <div className="flex flex-col gap-6">
          {curso.modulos.map((m) => (
            <section key={m.id}>
              <h2 className="font-coolvetica text-lg mb-2.5">{m.titulo}</h2>
              <div className="flex flex-col gap-2">
                {m.lecciones.map((l) => {
                  const Icon = TIPO_ICON[l.tipo];
                  return (
                    <Link
                      key={l.id}
                      href={`/cuenta/curso/${curso.id}/leccion/${l.id}`}
                      className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 hover:border-white/20 transition-colors"
                    >
                      <Icon size={16} className="text-white/40 shrink-0" />
                      <span className="flex-1 text-sm">{l.titulo}</span>
                      {l.visto && <Check size={15} className="text-green-400 shrink-0" />}
                    </Link>
                  );
                })}
                {m.lecciones.length === 0 && <p className="text-white/25 text-xs">Contenido en camino.</p>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
