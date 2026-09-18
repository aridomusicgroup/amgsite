import type { CursoPublico } from "@/lib/cursos-publico";
import type { Venta } from "@/lib/cursos-tipos";

/**
 * Lo mínimo de un curso para su tarjeta en el inicio y en /cursos. El inicio es
 * un componente de cliente: pasarle el curso completo mandaría al navegador la
 * configuración y las ~100 lecciones sin necesidad.
 */
export interface CursoTarjeta {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string | null;
  venta: Venta;
  conteo: { lecciones: number; capsulas: number; evaluaciones: number };
  /** Módulos de la ruta principal con lecciones (título y cuántas). */
  temario: { titulo: string; lecciones: number }[];
}

export function aTarjeta(c: CursoPublico): CursoTarjeta {
  return {
    id: c.id,
    slug: c.slug,
    titulo: c.titulo,
    descripcion: c.descripcion,
    venta: c.venta,
    conteo: { lecciones: c.conteo.lecciones, capsulas: c.conteo.capsulas, evaluaciones: c.conteo.evaluaciones },
    temario: c.modulos
      .filter((m) => m.ruta === "principal" && m.lecciones.length > 0)
      .map((m) => ({ titulo: m.titulo, lecciones: m.lecciones.length })),
  };
}
