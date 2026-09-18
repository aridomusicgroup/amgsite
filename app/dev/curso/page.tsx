import { notFound } from "next/navigation";
import { CursoHarness } from "@/components/dev/CursoHarness";

/**
 * Banco de pruebas visual de Cursos (editor, entregas, pantallas del alumno y
 * página de venta) con la plantilla real del curso y respuestas falsas. Sirve
 * para revisar el diseño sin iniciar sesión, sin tocar la base y antes de
 * correr el SQL. En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CursoHarness />;
}
