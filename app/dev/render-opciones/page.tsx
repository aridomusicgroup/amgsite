import { notFound } from "next/navigation";
import { RenderOpcionesHarness } from "@/components/dev/RenderOpcionesHarness";
import { TIPOS_RENDER, type TipoRender } from "@/lib/render-jobs";

/** Banco de pruebas visual del cuadro de opciones de render. En producción no existe. */
export default async function Page({ searchParams }: { searchParams: Promise<{ tipo?: string; viejo?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tipo, viejo } = await searchParams;
  const t = TIPOS_RENDER.find((x) => x === tipo) as TipoRender | undefined;
  return <RenderOpcionesHarness tipo={t} viejo={viejo === "1"} />;
}
