import { notFound } from "next/navigation";
import { ReaperFichaHarness } from "@/components/dev/ReaperFichaHarness";

/**
 * Banco de pruebas visual de la ficha de REAPER de un proyecto, con datos de
 * ejemplo (un tema de TRiP MX). Las llamadas a /api/admin se contestan en el
 * navegador. En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ReaperFichaHarness />;
}
