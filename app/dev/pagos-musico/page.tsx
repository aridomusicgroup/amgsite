import { notFound } from "next/navigation";
import { PagosMusicoHarness } from "@/components/dev/PagosMusicoHarness";

/** Banco de pruebas de Finanzas → Pagos a músicos. En producción no existe. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PagosMusicoHarness />;
}
