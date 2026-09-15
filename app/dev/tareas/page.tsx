import { notFound } from "next/navigation";
import { TareasHarness } from "@/components/dev/TareasHarness";

/**
 * Banco de pruebas visual de la pestaña Tareas y su ventana, con datos de
 * ejemplo (TRiP MX). Existe para poder revisar el diseño sin iniciar sesión y
 * sin tocar la base: las llamadas a /api/admin se contestan en el navegador.
 * En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TareasHarness />;
}
