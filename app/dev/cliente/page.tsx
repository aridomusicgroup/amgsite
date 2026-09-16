import { notFound } from "next/navigation";
import { ProgresoHarness } from "@/components/dev/ProgresoHarness";

/**
 * Banco de pruebas del avance que ve el cliente (EP con canciones que se
 * abren). Datos de ejemplo, sin base ni sesión. En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ProgresoHarness />;
}
