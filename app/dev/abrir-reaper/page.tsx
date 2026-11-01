import { notFound } from "next/navigation";
import { AbrirReaperHarness } from "@/components/dev/AbrirReaperHarness";

/**
 * Banco de pruebas visual del botón "Abrir en REAPER" (tablero de Producción y
 * sección REAPER), con datos de ejemplo. En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AbrirReaperHarness />;
}
