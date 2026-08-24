/**
 * Jala los datos de un beat directo de la API (pública) de BeatStars.
 * Probado server-side sin auth: getNewTrackV3 devuelve título, audio (streamUrl),
 * precio, tags y waveform. BPM y tonalidad NO vienen fiables aquí → los confirma
 * el admin en el formulario.
 */

const GQL = "https://core.prod.beatstars.net/graphql?op=getNewTrackV3";
const QUERY =
  "query getNewTrackV3($id: String!){ track(id:$id){ id title streamUrl price tags status bundle { waveform { url } } } }";

/** Construye la URL determinística de la portada (webp) por tamaño. */
function artwork(id: string, size: number): string {
  const o = {
    bucket: "prod-bts-track",
    key: `prod/track/artwork/${id}/artwork.png`,
    edits: { resize: { fit: "fill", width: size, height: size }, toFormat: "webp" },
  };
  return "https://cdn5.beatstars.com/" + Buffer.from(JSON.stringify(o)).toString("base64");
}

/** Resuelve el ID TKxxxx desde un link de BeatStars (largo o corto bsta.rs) o un ID suelto. */
export async function resolveBeatStarsId(input: string): Promise<string> {
  let url = String(input || "").trim();
  if (/^TK\d+$/i.test(url)) return url.toUpperCase();
  if (/bsta\.rs/i.test(url)) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      url = r.headers.get("location") || url;
    } catch {
      /* seguimos con la url tal cual */
    }
  }
  const m = url.match(/(\d{6,})/);
  if (!m) throw new Error("No se pudo extraer el ID del beat del link.");
  return "TK" + m[1];
}

export interface FetchedBeat {
  id: string;
  title: string;
  price: number;
  tags: string[];
  hlsUrl: string | null;
  waveformUrl: string | null;
  artworkUrl: string;
  artworkLarge: string;
  beatstarsUrl: string;
  status: string | null;
}

/** Trae el beat desde BeatStars listo para guardar (faltan bpm/key, los pone el admin). */
export async function fetchBeatFromBeatStars(input: string): Promise<FetchedBeat> {
  const id = await resolveBeatStarsId(input);
  const res = await fetch(GQL, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://www.beatstars.com" },
    body: JSON.stringify({ operationName: "getNewTrackV3", variables: { id }, query: QUERY }),
  });
  const json = await res.json().catch(() => null);
  const t = json?.data?.track;
  if (!t) throw new Error(`BeatStars no devolvió datos para ${id}.`);
  return {
    id,
    title: t.title,
    price: typeof t.price === "number" ? t.price : 25,
    tags: Array.isArray(t.tags) ? t.tags : [],
    hlsUrl: t.streamUrl ?? null,
    waveformUrl: t.bundle?.waveform?.url ?? null,
    artworkUrl: artwork(id, 400),
    artworkLarge: artwork(id, 800),
    beatstarsUrl: `https://www.beatstars.com/beat/${id.replace(/^TK/, "")}`,
    status: t.status ?? null,
  };
}
