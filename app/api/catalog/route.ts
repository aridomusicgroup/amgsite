import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

/**
 * Catálogo compacto para el chatbot (backend en Railway).
 * Devuelve solo lo necesario para que el agente pueda:
 *  - saber cuál es el último beat subido (`latest`)
 *  - mandar el link directo de un beat que el cliente pregunte (`url`)
 *  - ubicar un beat por título / artista / género
 */
export async function GET() {
  const { beats } = await getCatalog();

  const compact = beats.map((b) => ({
    title: b.title,
    url: b.url,
    slug: b.slug,
    price: b.price,
    exclusivePrice: b.exclusivePrice,
    bpm: b.bpm,
    key: b.key,
    genre: b.genre,
    artists: b.artists,
  }));

  return NextResponse.json(
    {
      total: compact.length,
      latest: compact[0] ?? null, // getCatalog ordena del más nuevo al más viejo
      beats: compact,
      updatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
