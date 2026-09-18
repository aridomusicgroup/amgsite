import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { requireModule } from "@/lib/supabase/auth-server";
import { getLeccionParaGrabar } from "@/lib/cursos-admin";
import { camposDeEtiqueta, esRellenar, formatoTiempo, indicacion, ETIQUETA_DE } from "@/lib/cursos-tipos";
import { TamanoTeleprompter } from "@/components/admin/curso/TamanoTeleprompter";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string; leccionId: string }> };

/**
 * Modo grabación: el guion de la lección en letra grande, para leerlo en una
 * tablet junto a la cámara. Lo que sigue en [RELLENAR] sale atenuado con la
 * indicación, para que se vea qué falta preparar antes de darle REC.
 */
export default async function GrabarPage({ params }: Props) {
  await requireModule("/admin/cursos");
  const { id, leccionId } = await params;
  const datos = await getLeccionParaGrabar(id, leccionId);
  if (!datos) notFound();
  const { curso, leccion, modulo, anterior, siguiente } = datos;
  const c = leccion.contenido;
  const campos = camposDeEtiqueta(leccion.etiqueta);
  const et = ETIQUETA_DE[leccion.etiqueta];
  const notas = typeof c.notas_grabacion === "string" && !esRellenar(c.notas_grabacion) ? c.notas_grabacion : null;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <Link href={`/admin/cursos/${curso.id}`} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors">
          <ArrowLeft size={15} /> {curso.titulo}
        </Link>
        <TamanoTeleprompter />
      </div>

      <p className="text-xs uppercase tracking-wider text-white/50">{modulo.titulo} · {et?.emoji} {et?.label}</p>
      <h1 className="font-coolvetica text-3xl sm:text-4xl mt-1 mb-2">{leccion.titulo}</h1>
      {leccion.marcadores.length > 0 && (
        <p className="text-white/50 text-sm mb-4">{leccion.marcadores.map((m) => `${formatoTiempo(m.t)} ${m.label}`).join(" · ")}</p>
      )}
      {notas && <p className="rounded-xl bg-amber-500/10 text-amber-200 px-4 py-3 text-sm mb-6 whitespace-pre-line">🎬 {notas}</p>}

      <div className="teleprompter flex flex-col gap-8 leading-relaxed" style={{ fontSize: "var(--tp-size, 1.5rem)" }}>
        {campos.filter((f) => f.key !== "fuente" || !esRellenar(c[f.key])).map((f) => {
          const v = c[f.key];
          const falta = esRellenar(v);
          return (
            <section key={f.key}>
              <h2 className="text-[0.55em] uppercase tracking-wider text-lgb-red mb-1">{f.label}</h2>
              <p className={`whitespace-pre-line ${falta ? "text-white/30 italic" : "text-white"}`}>
                {falta ? `Falta: ${indicacion(v) || f.ayuda}` : String(v)}
              </p>
            </section>
          );
        })}
      </div>

      <nav className="grid grid-cols-2 gap-3 mt-12">
        {anterior ? (
          <Link href={`/admin/cursos/${curso.id}/grabar/${anterior}`} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 hover:border-white/25"><ChevronLeft size={16} /> Anterior</Link>
        ) : <span />}
        {siguiente && (
          <Link href={`/admin/cursos/${curso.id}/grabar/${siguiente}`} className="flex items-center justify-end gap-2 rounded-xl border border-white/10 px-4 py-3 hover:border-white/25">Siguiente <ChevronRight size={16} /></Link>
        )}
      </nav>
    </div>
  );
}
