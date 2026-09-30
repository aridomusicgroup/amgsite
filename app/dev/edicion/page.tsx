import { notFound } from "next/navigation";
import { EdicionHarness } from "@/components/dev/EdicionHarness";

/**
 * Banco de pruebas visual del envío a edición por tema, con datos de ejemplo
 * (TRiP MX). Las llamadas a /api/admin se contestan en el navegador.
 * En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <EdicionHarness />;
}
