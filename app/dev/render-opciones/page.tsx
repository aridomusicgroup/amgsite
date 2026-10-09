import { notFound } from "next/navigation";
import { RenderOpcionesHarness } from "@/components/dev/RenderOpcionesHarness";

/** Banco de pruebas visual del cuadro de opciones de stems. En producción no existe. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RenderOpcionesHarness />;
}
