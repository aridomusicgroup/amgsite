"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CursoDetalle } from "@/lib/cursos-admin";
import { CabeceraCurso } from "@/components/admin/curso/CabeceraCurso";
import { ResumenProduccion, type FiltroProduccion, pasaFiltro } from "@/components/admin/curso/ResumenProduccion";
import { ModuloCard, NuevoModulo } from "@/components/admin/curso/ModuloCard";
import { AccesosSection } from "@/components/admin/curso/AccesosSection";

interface Props {
  curso: CursoDetalle;
  servicioEmail: string | null;
}

/**
 * Editor de un curso: cabecera (datos, mentoría, llamados), resumen de lo que
 * falta grabar, módulos con sus lecciones (guion [RELLENAR], capítulos,
 * recursos, quiz/rúbrica) y quién tiene acceso.
 */
export function CursoEditor({ curso, servicioEmail }: Props) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const [filtro, setFiltro] = useState<FiltroProduccion>("todas");
  const todas = curso.modulos.flatMap((m) => m.lecciones);
  // El correo de estreno sólo tiene sentido con el curso ya lanzado (en preventa nadie ve lecciones).
  const estrenos = { habilitado: curso.tipo === "curso" && !curso.config.preventa.activa, alumnos: curso.numAlumnos, avisadas: curso.estrenosAvisados };

  return (
    <div className="flex flex-col gap-8">
      <CabeceraCurso curso={curso} servicioEmail={servicioEmail} onSaved={refresh} />

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <h2 className="font-coolvetica text-xl">Contenido</h2>
        </div>
        <ResumenProduccion lecciones={todas} filtro={filtro} onFiltro={setFiltro} />
        <div className="flex flex-col gap-4 mt-4">
          {curso.modulos.map((m, i) => (
            <ModuloCard
              key={m.id}
              cursoId={curso.id}
              modulo={m}
              modulos={curso.modulos}
              visibles={m.lecciones.filter((l) => pasaFiltro(l, filtro))}
              filtrando={filtro !== "todas"}
              esPrimero={i === 0}
              esUltimo={i === curso.modulos.length - 1}
              onChanged={refresh}
              estrenos={estrenos}
            />
          ))}
        </div>
        <NuevoModulo cursoId={curso.id} onCreated={refresh} />
      </section>

      <AccesosSection curso={curso} onChanged={refresh} />
    </div>
  );
}
