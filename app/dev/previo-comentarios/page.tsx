import { notFound } from "next/navigation";
import { PrevioComentariosHarness } from "@/components/dev/PrevioComentariosHarness";

/**
 * Banco de pruebas visual de los comentarios del cliente sobre un previo y de la
 * pregunta "¿le mandas un previo al cliente?" tras Mezclar/Masterizar. Las
 * llamadas al sitio se contestan en el navegador. En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PrevioComentariosHarness />;
}
