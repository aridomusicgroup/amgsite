import "server-only";
import { unstable_cache } from "next/cache";
import rawBeats from "@/data/beats-beatstars.json";
import { formatKey, formatGenre, cleanTitle, detectArtists } from "@/lib/beatstars";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import { isDirectExclusive, EXCLUSIVE_DIRECT_PRICE } from "@/lib/exclusive";
import { DOMAINS } from "@/lib/site";

export interface CatalogBeat {
  id: string;
  slug: string;
  url: string;
  title: string;
  bpm: number;
  key: string;
  genre: string;
  artists: string[];
  mood: string;
  price: number;
  /** Precio de exclusiva en compra directa (beats nuevos); null = se negocia */
  exclusivePrice: number | null;
  plays: number;
  likes: number;
  tags: string[];
  coverGradient: string[];
  artworkUrl: string | null;
  artworkLarge: string | null;
  previewUrl: string | null;
  hlsUrl: string | null;
  waveformUrl: string | null;
  beatstarsUrl: string | null;
  /** Orden de antigüedad: ms para los de DB, id numérico para los del JSON */
  addedAt: number;
}

const beatUrl = (slug: string) => `${DOMAINS.beats}/beat/${slug}`;

// Base estática: los beats del archivo JSON
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsonBeats: CatalogBeat[] = (rawBeats as any[]).map((b) => {
  const title = cleanTitle(b.title);
  const slug = slugify(title);
  return {
    id: b.id,
    slug,
    url: beatUrl(slug),
    title,
    bpm: b.bpm ?? 0,
    key: formatKey(b.key),
    genre: b.genres?.length ? formatGenre(b.genres[0]) : "Latin",
    artists: detectArtists(b.title),
    mood: b.moods?.[0] ? b.moods[0].charAt(0) + b.moods[0].slice(1).toLowerCase() : "Energetic",
    price: b.price ?? 50,
    exclusivePrice: isDirectExclusive(b.id) ? EXCLUSIVE_DIRECT_PRICE : null,
    plays: b.plays ?? 0,
    likes: b.likes ?? 0,
    tags: b.tags ?? [],
    coverGradient: ["#1a0508", "#c42f42"],
    artworkUrl: b.artworkUrl ?? null,
    artworkLarge: b.artworkLarge ?? null,
    previewUrl: b.previewUrl ?? null,
    hlsUrl: b.hlsUrl ?? null,
    waveformUrl: b.waveformUrl ?? null,
    beatstarsUrl: b.beatstarsUrl ?? null,
    addedAt: parseInt(String(b.id).replace(/\D/g, "")) || 0,
  };
});

// Beats agregados desde el admin (tabla Supabase) → mismo formato
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbBeat(b: any): CatalogBeat {
  const title = cleanTitle(b.title);
  const slug = slugify(title);
  return {
    id: b.id,
    slug,
    url: beatUrl(slug),
    title,
    bpm: b.bpm ?? 0,
    key: b.key || "—",
    genre: b.genres?.length ? formatGenre(b.genres[0]) : "Latin",
    artists: detectArtists(b.title),
    mood: "Energetic",
    price: Number(b.price) || 25,
    exclusivePrice: isDirectExclusive(b.id) ? EXCLUSIVE_DIRECT_PRICE : null,
    plays: b.plays ?? 0,
    likes: b.likes ?? 0,
    tags: b.tags ?? [],
    coverGradient: ["#1a0508", "#c42f42"],
    artworkUrl: b.artwork_url ?? null,
    artworkLarge: b.artwork_large ?? null,
    previewUrl: b.preview_url ?? null,
    hlsUrl: b.hls_url ?? null,
    waveformUrl: b.waveform_url ?? null,
    beatstarsUrl: b.beatstars_url ?? null,
    addedAt: Date.parse(b.created_at) || Date.now(),
  };
}

/**
 * Devuelve TODO el catálogo (DB + JSON) combinado y ordenado del más nuevo al
 * más viejo. Es la única fuente de verdad para el detalle de beat, la API
 * pública y la API compacta que consume el chatbot.
 */
async function _getCatalog(): Promise<{ beats: CatalogBeat[]; artists: string[] }> {
  let dbBeats: CatalogBeat[] = [];
  // ids con fila en la tabla (activos o no): cualquier fila "tapa" al beat del
  // JSON con ese id. Así, marcar un beat original como active:false lo oculta del
  // catálogo sin tocar el archivo estático.
  let suppressed = new Set<string>();
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.from("beats").select("*");
    const rows = data ?? [];
    suppressed = new Set(rows.map((r) => r.id));
    dbBeats = rows.filter((r) => r.active !== false).map(mapDbBeat);
  } catch {
    /* sin DB → solo los del JSON */
  }

  const all = [...dbBeats, ...jsonBeats.filter((b) => !suppressed.has(b.id))];
  all.sort((a, b) => b.addedAt - a.addedAt); // más nuevos primero

  const artistCount = new Map<string, number>();
  for (const b of all) for (const a of b.artists) artistCount.set(a, (artistCount.get(a) ?? 0) + 1);
  const artists = [...artistCount.entries()].sort((x, y) => y[1] - x[1]).map(([a]) => a);

  return { beats: all, artists };
}

/**
 * Catálogo cacheado (Next `unstable_cache`): sirve el resultado hasta 60s sin
 * volver a pegarle a Supabase — ahorra lecturas de DB y egress del free tier.
 * Se invalida al instante con `revalidateTag("catalog")` al agregar/editar/borrar
 * un beat (ver rutas admin/add-beat y admin/catalog), así la tienda queda fresca.
 */
export const getCatalog = unstable_cache(_getCatalog, ["catalog"], {
  revalidate: 60,
  tags: ["catalog"],
});

/** Busca un beat por su slug (o, como respaldo, por su id de BeatStars). */
export async function getBeatBySlug(slugOrId: string): Promise<CatalogBeat | null> {
  const { beats } = await getCatalog();
  const key = slugOrId.toLowerCase();
  return (
    beats.find((b) => b.slug === key) ??
    beats.find((b) => b.id.toLowerCase() === key) ??
    null
  );
}
