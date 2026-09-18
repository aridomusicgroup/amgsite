import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import type { CursoTarjeta } from "@/lib/cursos-tarjeta";
import { PrecioCurso } from "@/components/cursos/PrecioCurso";

const CTA: Record<"es" | "en", Record<CursoTarjeta["venta"]["estado"], string>> = {
  es: { preventa: "Apartar mi lugar", preventa_cerrada: "Avísame cuando abra", venta: "Ver el curso", oculto: "Ver el curso" },
  en: { preventa: "Reserve my spot", preventa_cerrada: "Notify me", venta: "See the course", oculto: "See the course" },
};

/**
 * Un curso en el sitio principal (inicio y /cursos): oscuro como la tienda de
 * beats, igual en modo claro y oscuro. El contenido del curso va en español.
 */
export function TarjetaCurso({ c, lang = "es" }: { c: CursoTarjeta; lang?: "es" | "en" }) {
  const v = c.venta;
  const etiqueta = v.estado === "preventa" ? "Preventa fundador"
    : v.estado === "preventa_cerrada" ? (v.motivoCierre === "cupo" ? "Preventa llena" : "Muy pronto")
    : "Curso en línea";
  const temario = c.temario.slice(0, 7);
  const stats = [
    c.conteo.lecciones && `${c.conteo.lecciones} lecciones`,
    c.conteo.capsulas && `${c.conteo.capsulas} Datos Crack`,
    c.conteo.evaluaciones && `${c.conteo.evaluaciones} evaluaciones`,
  ].filter(Boolean);

  return (
    <article className="relative rounded-3xl overflow-hidden bg-lgb-black text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-lgb-black via-[#1a0508] to-lgb-black" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-lgb-red/10 blur-3xl" />

      <div className="relative z-10 grid lg:grid-cols-[1.15fr_1fr]">
        <div className="p-7 sm:p-12 flex flex-col">
          <span className="w-fit text-[11px] uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-lgb-red text-white mb-5">{etiqueta}</span>
          <h3 className="font-coolvetica text-4xl sm:text-5xl leading-[0.95] mb-3">{c.titulo}</h3>
          {c.descripcion && <p className="text-white/70 leading-relaxed mb-4 max-w-md">{c.descripcion}</p>}
          {stats.length > 0 && <p className="text-xs text-white/50 mb-6">{stats.join(" · ")}</p>}
          <PrecioCurso venta={v} className="mb-7" />
          <Link href={`/cursos/${c.slug}`}
            className="group inline-flex items-center gap-3 bg-lgb-red text-white px-7 py-4 rounded-full font-medium hover:bg-red-700 transition-all duration-300 hover:scale-105 active:scale-95 w-fit">
            <GraduationCap size={18} /> {CTA[lang][v.estado]}
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {temario.length > 0 && (
          <div className="hidden lg:flex items-center p-10">
            <ol className="w-full flex flex-col gap-2">
              {temario.map((m) => (
                <li key={m.titulo} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="flex-1 text-sm text-white/80 truncate">{m.titulo}</span>
                  <span className="text-[11px] text-white/40 shrink-0">{m.lecciones}</span>
                </li>
              ))}
              <li className="text-xs text-white/40 px-1">…y el temario completo en la página del curso</li>
            </ol>
          </div>
        )}
      </div>
    </article>
  );
}
