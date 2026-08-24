// Cliente mínimo de la Graph API de Meta (Instagram) para leer estadísticas.
// Solo servidor: se llama desde el endpoint de sincronización.
const GRAPH = "https://graph.facebook.com/v21.0";

type GraphParams = Record<string, string | number>;
interface InsightResponse {
  data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[];
}

async function graphGet<T>(path: string, params: GraphParams, token: string): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Graph API ${res.status}`);
  return json as T;
}

function firstValue(r: InsightResponse, name: string): number | undefined {
  const m = r.data?.find((x) => x.name === name);
  const v = m?.values?.[0]?.value ?? m?.total_value?.value;
  return typeof v === "number" ? v : undefined;
}

export interface IgAccount {
  id: string; username?: string; name?: string;
  followers_count?: number; media_count?: number; profile_picture_url?: string;
}

export async function getIgAccount(igId: string, token: string): Promise<IgAccount> {
  return graphGet<IgAccount>(igId, { fields: "id,username,name,followers_count,media_count,profile_picture_url" }, token);
}

/** Alcance del día a nivel cuenta (best-effort; Meta cambió el formato entre versiones). */
export async function getIgAccountReach(igId: string, token: string): Promise<number | null> {
  // 1) Formato clásico: serie de tiempo por día.
  try {
    const r = await graphGet<InsightResponse>(`${igId}/insights`, { metric: "reach", period: "day" }, token);
    const v = firstValue(r, "reach");
    if (typeof v === "number") return v;
  } catch { /* prueba el siguiente formato */ }
  // 2) Formato nuevo: valor total (requiere metric_type=total_value).
  try {
    const r = await graphGet<InsightResponse>(`${igId}/insights`, { metric: "reach", period: "day", metric_type: "total_value" }, token);
    const v = firstValue(r, "reach");
    if (typeof v === "number") return v;
  } catch { /* sin alcance disponible */ }
  return null;
}

export interface IgMedia {
  id: string; caption?: string; media_type?: string; media_product_type?: string;
  permalink?: string; thumbnail_url?: string; media_url?: string; timestamp?: string;
  like_count?: number; comments_count?: number;
}

export async function getIgMedia(igId: string, token: string, limit = 50): Promise<IgMedia[]> {
  const r = await graphGet<{ data?: IgMedia[] }>(
    `${igId}/media`,
    { fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count", limit },
    token,
  );
  return r.data ?? [];
}

export interface MediaInsights { reach?: number; saved?: number; shares?: number; views?: number }

/** Insights por publicación. Best-effort: si falla, regresa {} (likes/comentarios ya vienen del media).
 *  'views' = reproducciones (Meta renombró 'plays'→'views'). reach/saved de reels suelen venir 0 (límite de Meta). */
export async function getMediaInsights(media: IgMedia, token: string): Promise<MediaInsights> {
  const isReel = media.media_product_type === "REELS";
  const attempts = isReel
    ? ["reach,saved,shares,views", "views,reach,saved", "reach,saved"]
    : ["reach,saved,shares,views", "reach,saved,shares", "reach,saved"];
  for (const metric of attempts) {
    try {
      const r = await graphGet<InsightResponse>(`${media.id}/insights`, { metric }, token);
      return {
        reach: firstValue(r, "reach"), saved: firstValue(r, "saved"),
        shares: firstValue(r, "shares"), views: firstValue(r, "views"),
      };
    } catch { /* prueba el siguiente set de métricas */ }
  }
  return {};
}
