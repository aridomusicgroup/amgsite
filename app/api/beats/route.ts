import { NextRequest, NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const artist = searchParams.get("artist");
  const sort = searchParams.get("sort") || "newest";
  const search = searchParams.get("search")?.toLowerCase();

  const { beats, artists } = await getCatalog();

  let filtered = [...beats];
  if (artist && artist !== "all") filtered = filtered.filter((b) => b.artists.includes(artist));
  if (search) {
    filtered = filtered.filter(
      (b) =>
        b.title.toLowerCase().includes(search) ||
        b.artists.some((a) => a.toLowerCase().includes(search)) ||
        b.tags.some((t) => t.toLowerCase().includes(search))
    );
  }

  // getCatalog ya devuelve "más nuevos primero"; reordenamos solo si piden otro criterio.
  // Los destacados desde el panel van arriba en el orden por defecto (no en
  // getCatalog: el chatbot toma el primero de ahí como "el último beat").
  if (sort === "popular") filtered.sort((a, b) => b.plays - a.plays);
  else if (sort === "newest") filtered.sort((a, b) => Number(b.destacado) - Number(a.destacado) || b.addedAt - a.addedAt);
  else if (sort === "price-low") filtered.sort((a, b) => a.price - b.price);
  else if (sort === "price-high") filtered.sort((a, b) => b.price - a.price);

  return NextResponse.json({ beats: filtered, total: filtered.length, artists });
}
