import { notFound } from "next/navigation";
import { CascadaHarness } from "@/components/dev/CascadaHarness";

/**
 * Banco de pruebas de la ventana de borrado con dependencias, con datos de
 * ejemplo. En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CascadaHarness />;
}
