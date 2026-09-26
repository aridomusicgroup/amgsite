import "server-only";
import { unstable_cache } from "next/cache";
import rawBeats from "@/data/beats-beatstars.json";
import { formatKey, formatGenre, cleanTitle, detectArtists } from "@/lib/beatstars";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
import rawLicenses from "@/data/licenses.json";
import { isDirectExclusive, EXCLUSIVE_DIRECT_PRICE } from "@/lib/exclusive";
import { DOMAINS } from "@/lib/site";
import { aplicarFicha, preciosEfectivos, idYoutube, type FichaRow, type LicenciaId, type PreciosEfectivos } from "@/lib/beat-ficha";

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
  /** "Desde $X": el precio de la licencia más barata (Basic) de ESTE beat. */
  price: number;
  /** Precio de exclusiva en compra directa; null = se negocia */
  exclusivePrice: number | null;
  /** Lo que cuesta cada licencia de este beat (global + ajuste de su ficha). */
  precios: PreciosEfectivos;
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
  /** Texto propio del beat (ficha del panel), para su página y el SEO. */
  descripcion: string | null;
  /** Sale primero en la tienda. */
  destacado: boolean;
  /** Sólo lo ve el panel: la tienda nunca recibe beats ocultos. */
  oculto: boolean;
  /** Id del video de YouTube que se incrusta en la página del beat (Promoción). */
  video: string | null;
}

/** Lo que sale de las dos fuentes, antes de la ficha y los precios. */
export type BeatBase = Omit<CatalogBeat, "price" | "exclusivePrice" | "precios" | "descripcion" | "destacado" | "oculto" | "video">;

const GLOBALES = Object.fromEntries(
  (rawLicenses as Array<{ id: string; price: number | null }>).map((l) => [l.id, l.price]),
) as Partial<Record<LicenciaId, number | null>>;

/**
 * Precio de cada licencia de un beat. Única regla para la tienda, el checkout
 * y el panel: si cada uno calculara por su lado, se podría mostrar un precio y
 * cobrar otro.
 */
export function preciosDeBeat(beatId: string, ficha?: FichaRow | null): PreciosEfectivos {
  return preciosEfectivos({
    globales: GLOBALES,
    ajuste: ficha?.precios,
    modo: ficha?.exclusiva_modo,
    esLegacy: !isDirectExclusive(beatId),
    exclusivaDirecta: EXCLUSIVE_DIRECT_PRICE,
  });
}

const beatUrl = (slug: string) => `${DOMAINS.beats}/beat/${slug}`;

// Base estática: los beats del archivo JSON
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsonBeats: BeatBase[] = (rawBeats as any[]).map((b) => {
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
function mapDbBeat(b: any): BeatBase {
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

const jsonPorId = new Map(jsonBeats.map((b) => [b.id, b]));

/** Aplica la ficha del panel y calcula precios. Objeto nuevo: la base no se toca. */
function terminar(base: BeatBase, ficha: FichaRow | undefined, ocultoBase: boolean, video: string | null = null): CatalogBeat {
  const precios = preciosDeBeat(base.id, ficha);
  return {
    ...aplicarFicha(base, ficha),
    precios,
    price: precios.basic ?? 25,
    exclusivePrice: precios.exclusive,
    oculto: ocultoBase || Boolean(ficha?.oculto),
    video,
  };
}

/** Beat → id del video de YouTube que va en su página. Vacío si no hay tabla. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function leerVideos(sb: any, beatId?: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    let q = sb.from("beat_publicaciones").select("beat_id, url").eq("mostrar_en_tienda", true).eq("canal", "youtube");
    if (beatId) q = q.eq("beat_id", beatId);
    const { data, error } = await q;
    if (error) return out;
    for (const r of data ?? []) {
      const id = idYoutube(r.url as string);
      if (id) out.set(r.beat_id as string, id);
    }
  } catch {
    /* tabla aún no creada */
  }
  return out;
}

/**
 * La ficha de cada beat (tabla `beat_ficha`). Mapa vacío si la tabla todavía
 * no existe: el catálogo sigue saliendo igual que antes de correr el SQL.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function leerFichas(sb: any): Promise<Map<string, FichaRow>> {
  const out = new Map<string, FichaRow>();
  try {
    const { data, error } = await sb.from("beat_ficha").select("*");
    if (error) return out;
    for (const r of (data ?? []) as FichaRow[]) out.set(r.beat_id, r);
  } catch {
    /* tabla aún no creada */
  }
  return out;
}

/**
 * TODO el catálogo (DB + JSON) combinado, con la ficha del panel encima, del
 * más nuevo al más viejo.
 *
 * Quién gana: una fila activa en `beats` reemplaza al beat del JSON con ese id.
 * Una fila con `active:false` para un beat del JSON es la forma VIEJA de
 * ocultarlo (una fila "tapón" sin portada ni audio): se sigue respetando, pero
 * el beat que se muestra en el panel es el del JSON, no el tapón vacío. La
 * forma nueva de ocultar es `beat_ficha.oculto`.
 */
async function construirCatalogo(incluirOcultos: boolean): Promise<{ beats: CatalogBeat[]; artists: string[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  let fichas = new Map<string, FichaRow>();
  let videos = new Map<string, string>();
  try {
    const sb = supabaseAdmin();
    const [res, f, v] = await Promise.all([sb.from("beats").select("*"), leerFichas(sb), leerVideos(sb)]);
    rows = res.data ?? [];
    fichas = f;
    videos = v;
  } catch {
    /* sin DB → solo los del JSON */
  }

  const filaPorId = new Map(rows.map((r) => [r.id as string, r]));
  const bases: { base: BeatBase; oculto: boolean }[] = [];
  for (const r of rows) {
    if (r.active !== false) bases.push({ base: mapDbBeat(r), oculto: false });
    else if (!jsonPorId.has(r.id)) bases.push({ base: mapDbBeat(r), oculto: true });
  }
  for (const j of jsonBeats) {
    const r = filaPorId.get(j.id);
    if (!r) bases.push({ base: j, oculto: false });
    else if (r.active === false) bases.push({ base: j, oculto: true });
  }

  const todos = bases.map(({ base, oculto }) => terminar(base, fichas.get(base.id), oculto, videos.get(base.id) ?? null));
  const all = incluirOcultos ? todos : todos.filter((b) => !b.oculto);
  all.sort((a, b) => b.addedAt - a.addedAt); // más nuevos primero

  const artistCount = new Map<string, number>();
  for (const b of all) {
    if (b.oculto) continue;
    for (const a of b.artists) artistCount.set(a, (artistCount.get(a) ?? 0) + 1);
  }
  const artists = [...artistCount.entries()].sort((x, y) => y[1] - x[1]).map(([a]) => a);

  return { beats: all, artists };
}

/**
 * Catálogo cacheado (Next `unstable_cache`): sirve el resultado hasta 60s sin
 * volver a pegarle a Supabase — ahorra lecturas de DB y egress del free tier.
 * Se invalida al instante con `revalidateTag("catalog")` al agregar/editar/borrar
 * un beat (ver rutas admin/add-beat y admin/catalog), así la tienda queda fresca.
 */
export const getCatalog = unstable_cache(() => construirCatalogo(false), ["catalog"], {
  revalidate: 60,
  tags: ["catalog"],
});

/**
 * Para el panel: SIN caché (acabas de editar y tienes que ver el cambio) e
 * incluye los ocultos, para poder volver a mostrarlos.
 */
export function catalogoCompleto(): Promise<{ beats: CatalogBeat[]; artists: string[] }> {
  return construirCatalogo(true);
}

/** Los ids que vienen del archivo JSON (los "originales"). */
export const esOriginal = (id: string): boolean => jsonPorId.has(id);

export interface BeatParaPanel {
  /** Como lo ve la tienda (con la ficha encima), aunque esté oculto. */
  beat: CatalogBeat;
  /** Como sale de su fuente, SIN la ficha: es lo que vuelve al restablecer. */
  base: BeatBase;
  /** Precios sin ajuste de la ficha (lo global) y el modo de exclusiva por defecto. */
  preciosBase: PreciosEfectivos;
  ficha: FichaRow | null;
  /** false = no existe `beat_ficha` (falta correr supabase-beat-ficha.sql). */
  tablaFicha: boolean;
  source: "original" | "agregado";
  /** Título tal cual viene de BeatStars (con comillas): de ahí sale el nombre corto. */
  tituloCrudo: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fila: any | null;
}

/** Un beat con todas sus capas separadas, para su ficha en el panel. Sin caché. */
export async function beatParaPanel(id: string): Promise<BeatParaPanel | null> {
  const sb = supabaseAdmin();
  const json = jsonPorId.get(id) ?? null;
  const [filaRes, fichaRes, videos] = await Promise.all([
    sb.from("beats").select("*").eq("id", id).maybeSingle(),
    sb.from("beat_ficha").select("*").eq("beat_id", id).maybeSingle(),
    leerVideos(sb, id),
  ]);
  const fila = filaRes.data ?? null;
  const tablaFicha = !fichaRes.error;
  const ficha = (tablaFicha ? fichaRes.data : null) as FichaRow | null;

  let base: BeatBase | null = null;
  let ocultoBase = false;
  if (fila && fila.active !== false) base = mapDbBeat(fila);
  else if (json) {
    base = json;
    ocultoBase = Boolean(fila); // fila tapón vieja = oculto
  } else if (fila) {
    base = mapDbBeat(fila);
    ocultoBase = true;
  }
  if (!base) return null;

  const crudo = (rawBeats as Array<{ id: string; title: string }>).find((b) => b.id === id)?.title;
  return {
    beat: terminar(base, ficha ?? undefined, ocultoBase, videos.get(id) ?? null),
    base,
    preciosBase: preciosDeBeat(id, null),
    ficha,
    tablaFicha,
    source: json ? "original" : "agregado",
    tituloCrudo: crudo ?? (fila?.title as string) ?? base.title,
    fila,
  };
}

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
