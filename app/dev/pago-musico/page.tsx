import { notFound } from "next/navigation";
import { PagoMusicoHarness } from "@/components/dev/PagoMusicoHarness";

/**
 * Banco de pruebas visual de la ventanita "¿Le pagas al músico?" que sale al
 * palomear una grabación. Las llamadas a /api/admin se contestan en el
 * navegador. En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PagoMusicoHarness />;
}
