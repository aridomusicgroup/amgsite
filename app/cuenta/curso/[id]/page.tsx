import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlayCircle, Award, Download } from "lucide-react";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { correosDe, getCursoDetalleCliente } from "@/lib/cursos-cliente";
import { resumenPractica } from "@/lib/curso-practica";
import { elegibilidad } from "@/lib/curso-certificados";
import { cuentaParaAvance } from "@/lib/cursos-tipos";
import { MapaCurso } from "@/components/cuenta/curso/MapaCurso";
import { BitacoraPractica } from "@/components/cuenta/curso/BitacoraPractica";
import { CtaLeccion } from "@/components/cuenta/curso/CtaLeccion";

export const metadata: Metadata = { title: "Mi curso — Árido Music Group", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function CursoClientePage({ params }: Props) {
  const email = await getCustomerEmail();
  if (!email) redirect("/cuenta/login");

  const { id } = await params;
  const curso = await getCursoDetalleCliente(email, id);
  if (!curso) notFound();

  const emails = await correosDe(email);
  const [practica, cert] = await Promise.all([resumenPractica(emails, curso.id), elegibilidad(curso, emails)]);

  const todas = curso.modulos.flatMap((m) => m.lecciones);
  const principal = todas.filter(cuentaParaAvance);
  // “Continúa donde te quedaste”: la primera de la ruta principal que no ha visto.
  const siguiente = principal.find((l) => !l.visto) ?? principal[0] ?? todas[0];
  const empezo = principal.some((l) => l.visto);
  const mentoria = curso.config.mentoria;
  const mostrarMentoria = curso.tipo === "curso" && mentoria.estado !== "oculta" && !curso.esMiembro;

  return (
    <main className="min-h-screen bg-lgb-black text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-5 py-8">
        <Link href="/cuenta" className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-6 transition-colors w-fit">
          <ArrowLeft size={15} /> Mi cuenta
        </Link>

        <h1 className="font-coolvetica text-3xl mb-1">{curso.titulo}</h1>
        {curso.descripcion && <p className="text-white/50 text-sm mb-4">{curso.descripcion}</p>}
        {curso.venceEn && (
          <p className="text-xs text-white/50 mb-4">
            Tu acceso vence el {new Date(curso.venceEn).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}.
          </p>
        )}

        {curso.tipo === "curso" && (
          <div className="flex items-center gap-2 mb-5">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-lgb-red rounded-full" style={{ width: `${curso.pct}%` }} />
            </div>
            <span className="text-white/50 text-xs shrink-0">{curso.pct}% de la ruta principal</span>
          </div>
        )}

        {siguiente && (
          <Link href={`/cuenta/curso/${curso.id}/leccion/${siguiente.id}`}
            className="flex items-center gap-3 rounded-2xl bg-lgb-red px-5 py-4 mb-5 hover:bg-red-700 transition-colors">
            <PlayCircle size={26} className="shrink-0" />
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wider text-white/80">{empezo ? "Continúa donde te quedaste" : "Empieza aquí"}</span>
              <span className="block font-medium truncate">{siguiente.titulo}</span>
            </span>
          </Link>
        )}

        {curso.tipo === "curso" && (
          <div className="mb-5">
            <BitacoraPractica cursoId={curso.id} racha={practica.racha} semana={practica.semana} meta={curso.config.meta_semanal_min} hoy={practica.hoy} />
          </div>
        )}

        {(cert.termino || cert.mencion) && (
          <section className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] p-4 mb-5 flex flex-wrap items-center gap-3">
            <Award size={22} className="text-amber-300 shrink-0" />
            <p className="flex-1 min-w-[12rem] text-sm">¡Terminaste la ruta principal! Tu certificado ya está listo.</p>
            <a href={`/api/cuenta/curso/${curso.id}/certificado?tipo=termino`} className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full bg-white/10 hover:bg-white/15">
              <Download size={13} /> De término
            </a>
            {cert.mencion && (
              <a href={`/api/cuenta/curso/${curso.id}/certificado?tipo=mencion`} className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full bg-amber-400/20 text-amber-200 hover:bg-amber-400/30">
                <Download size={13} /> Con mención
              </a>
            )}
          </section>
        )}

        {mostrarMentoria && (
          <div className="mb-6">
            <CtaLeccion cta="mentoria" texto={curso.config.cta_textos.mentoria ?? null} cursoId={curso.id} leccionId=""
              cursoTitulo={curso.titulo} entregaHref={null}
              mentoria={{ estado: mentoria.estado, cursoId: mentoria.curso_id, precioMes: mentoria.precio_mes, esMiembro: curso.esMiembro }} />
          </div>
        )}

        {todas.length ? (
          <MapaCurso cursoId={curso.id} modulos={curso.modulos} />
        ) : (
          <p className="text-white/50 text-sm">El contenido se está grabando. Te avisamos en cuanto salga la primera lección.</p>
        )}
      </div>
    </main>
  );
}
