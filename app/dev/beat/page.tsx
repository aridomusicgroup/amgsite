import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BeatHarness } from "@/components/dev/BeatHarness";

/**
 * Banco de pruebas visual de la ficha de beat y de la lista del catálogo, con
 * datos de ejemplo. Existe para revisar el diseño sin iniciar sesión y sin
 * tocar la base: las llamadas a /api/admin se contestan en el navegador.
 * En producción no existe.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <BeatHarness />
    </Suspense>
  );
}
