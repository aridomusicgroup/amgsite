import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { certificadoPublico } from "@/lib/curso-certificados";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verificar certificado — Árido Music Group", robots: { index: false } };

type Props = { params: Promise<{ id: string }> };

/** Página pública para comprobar que un certificado es auténtico (el folio va impreso en el PDF). */
export default async function VerificarCertificadoPage({ params }: Props) {
  const { id } = await params;
  const cert = await certificadoPublico(id);
  if (!cert) notFound();

  return (
    <main className="min-h-screen bg-lgb-black text-white flex items-center">
      <div className="max-w-md mx-auto px-5 py-16 text-center">
        <BadgeCheck size={48} className="text-green-400 mx-auto mb-4" />
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/50 mb-2">Certificado auténtico</p>
        <h1 className="font-coolvetica text-3xl mb-2">{cert.nombre}</h1>
        <p className="text-white/70">
          {cert.tipo === "mencion" ? "Completó con mención" : "Completó"} el curso <b className="text-white">{cert.curso}</b>
        </p>
        <p className="text-white/50 text-sm mt-2">
          {new Date(cert.emitidoEn).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })} · Folio {id.slice(0, 8).toUpperCase()}
        </p>
        <p className="text-white/40 text-xs mt-8">Árido Music Group · Latino Gang Beats</p>
      </div>
    </main>
  );
}
