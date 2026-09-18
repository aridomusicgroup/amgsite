"use client";
import { useLang } from "@/lib/i18n";
import { Reveal } from "@/components/shared/Reveal";
import type { CursoTarjeta } from "@/lib/cursos-tarjeta";
import { TarjetaCurso } from "@/components/cursos/TarjetaCurso";

/**
 * Cursos en el sitio principal. En el inicio es una sección que no aparece si
 * no hay cursos visibles; en /cursos (`pagina`) es el encabezado de la página
 * y, sin cursos, dice “muy pronto”.
 */
export function AridoCursos({ cursos, pagina = false }: { cursos: CursoTarjeta[]; pagina?: boolean }) {
  const { lang } = useLang();
  if (!cursos.length && !pagina) return null;
  const Titulo = pagina ? "h1" : "h2";

  return (
    <section id="cursos" className={`px-6 max-w-7xl mx-auto ${pagina ? "pt-28 pb-24" : "py-24"}`}>
      <Reveal>
        <div className="text-center mb-12">
          <p className="text-arido-red text-sm font-asphaltic tracking-[0.3em] uppercase mb-3">
            {lang === "es" ? "Academia Árido" : "Árido Academy"}
          </p>
          <Titulo className="text-5xl sm:text-6xl font-coolvetica text-[var(--fg)] leading-tight">
            {lang === "es" ? "Aprende con nosotros" : "Learn with us"}
          </Titulo>
          <p className="text-[var(--fg-2)] mt-3 max-w-xl mx-auto">
            {lang === "es"
              ? "Cursos en línea hechos por el equipo de Árido: lo mismo que usamos en el estudio para grabar regional mexicano."
              : "Online courses by the Árido team: the same things we use in the studio to record Mexican regional music."}
          </p>
        </div>
      </Reveal>

      {cursos.length ? (
        <div className="flex flex-col gap-6">
          {cursos.map((c) => (
            <Reveal key={c.id}><TarjetaCurso c={c} lang={lang === "en" ? "en" : "es"} /></Reveal>
          ))}
        </div>
      ) : (
        <p className="text-center text-[var(--fg-2)]">
          {lang === "es" ? "Muy pronto. Síguenos en redes para enterarte del primero." : "Coming soon. Follow us to hear about the first one."}
        </p>
      )}
    </section>
  );
}
