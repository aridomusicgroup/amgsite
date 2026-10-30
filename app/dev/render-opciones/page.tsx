import { notFound } from "next/navigation";
import { RenderOpcionesHarness, type EstadoOnda } from "@/components/dev/RenderOpcionesHarness";
import { TIPOS_RENDER, type TipoRender } from "@/lib/render-jobs";

const ONDAS: EstadoOnda[] = ["sintetica", "sin", "vieja", "lenta", "omitidos"];

/** Banco de pruebas visual del cuadro de opciones de render. En producción no existe. */
export default async function Page({ searchParams }: {
  searchParams: Promise<{ tipo?: string; viejo?: string; onda?: string; picos?: string; dur?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { tipo, viejo, onda, picos, dur } = await searchParams;
  const t = TIPOS_RENDER.find((x) => x === tipo) as TipoRender | undefined;
  const o = ONDAS.find((x) => x === onda);
  return <RenderOpcionesHarness tipo={t} viejo={viejo === "1"} onda={o} picos={picos} dur={dur ? Number(dur) : undefined} />;
}
