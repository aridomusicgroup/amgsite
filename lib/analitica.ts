// Analítica social (Instagram/Facebook): lectura para el dashboard + sincronización desde Meta.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getIgAccount, getIgAccountReach, getIgMedia, getMediaInsights } from "@/lib/meta";

export interface SocialCuenta {
  id: string; plataforma: string; nombre: string; external_id: string; page_id: string | null;
}
export interface AnaliticaPost {
  media_id: string; tipo: string | null; permalink: string | null; caption: string | null;
  thumbnail: string | null; publicado_at: string | null;
  likes: number; comentarios: number; guardados: number; compartidos: number;
  alcance: number; reproducciones: number; interacciones: number;
}
export interface AnaliticaSnapshot { fecha: string; seguidores: number | null; alcance: number | null }
export interface AnaliticaData {
  cuenta: SocialCuenta;
  seguidores: number | null;
  seguidoresDelta: number | null;
  publicaciones: number;
  interaccionesTotales: number;
  reproduccionesTotales: number;
  alcanceUlt: number | null;
  snapshots: AnaliticaSnapshot[];
  posts: AnaliticaPost[];
  ultimaSync: string | null;
}

/** Lectura defensiva: si las tablas aún no existen, regresa null (no rompe el deploy). */
export async function getAnalitica(): Promise<AnaliticaData | null> {
  const sb = supabaseAdmin();
  const cuentaRes = await sb
    .from("social_cuentas").select("id, plataforma, nombre, external_id, page_id")
    .eq("activo", true).order("created_at", { ascending: true }).limit(1);
  if (cuentaRes.error || !cuentaRes.data?.length) return null;
  const cuenta = cuentaRes.data[0] as SocialCuenta;

  const [snapRes, postRes] = await Promise.all([
    sb.from("social_snapshots").select("fecha, seguidores, alcance").eq("cuenta_id", cuenta.id).order("fecha", { ascending: true }).limit(90),
    sb.from("social_posts").select("*").eq("cuenta_id", cuenta.id).order("publicado_at", { ascending: false }).limit(100),
  ]);

  const snapshots: AnaliticaSnapshot[] = (snapRes.data ?? []).map((s) => ({
    fecha: s.fecha as string,
    seguidores: (s.seguidores as number | null) ?? null,
    alcance: (s.alcance as number | null) ?? null,
  }));

  const posts: AnaliticaPost[] = (postRes.data ?? []).map((p) => {
    const likes = Number(p.likes) || 0, comentarios = Number(p.comentarios) || 0;
    const guardados = Number(p.guardados) || 0, compartidos = Number(p.compartidos) || 0;
    return {
      media_id: p.media_id as string, tipo: (p.tipo as string | null) ?? null,
      permalink: (p.permalink as string | null) ?? null, caption: (p.caption as string | null) ?? null,
      thumbnail: (p.thumbnail_url as string | null) ?? null, publicado_at: (p.publicado_at as string | null) ?? null,
      likes, comentarios, guardados, compartidos,
      alcance: Number(p.alcance) || 0, reproducciones: Number(p.reproducciones) || 0,
      interacciones: likes + comentarios + guardados + compartidos,
    };
  });

  const withFollowers = snapshots.filter((s) => s.seguidores != null);
  const last = withFollowers[withFollowers.length - 1] ?? null;
  const prev = withFollowers.length > 1 ? withFollowers[withFollowers.length - 2] : null;
  const seguidoresDelta = last?.seguidores != null && prev?.seguidores != null ? last.seguidores - prev.seguidores : null;

  return {
    cuenta,
    seguidores: last?.seguidores ?? null,
    seguidoresDelta,
    publicaciones: posts.length,
    interaccionesTotales: posts.reduce((a, p) => a + p.interacciones, 0),
    reproduccionesTotales: posts.reduce((a, p) => a + p.reproducciones, 0),
    alcanceUlt: last?.alcance ?? null,
    snapshots,
    posts,
    ultimaSync: snapshots[snapshots.length - 1]?.fecha ?? null,
  };
}

export interface SyncResult { ok: boolean; cuenta?: string; posts?: number; seguidores?: number | null; error?: string }

/** Trae de Meta el snapshot de cuenta + métricas por publicación y las guarda. */
export async function syncAnalitica(): Promise<SyncResult[]> {
  const token = process.env.META_SYSTEM_TOKEN;
  if (!token) return [{ ok: false, error: "Falta META_SYSTEM_TOKEN en el entorno." }];

  const sb = supabaseAdmin();
  const cuentasRes = await sb.from("social_cuentas").select("id, plataforma, nombre, external_id, page_id").eq("activo", true);
  if (cuentasRes.error) return [{ ok: false, error: cuentasRes.error.message }];

  const cuentas = (cuentasRes.data ?? []) as SocialCuenta[];
  const results: SyncResult[] = [];

  for (const cuenta of cuentas) {
    if (cuenta.plataforma !== "instagram") continue;
    try {
      const acc = await getIgAccount(cuenta.external_id, token);
      const reach = await getIgAccountReach(cuenta.external_id, token);
      const hoy = new Date().toISOString().slice(0, 10);

      await sb.from("social_snapshots").upsert(
        { cuenta_id: cuenta.id, fecha: hoy, seguidores: acc.followers_count ?? null, alcance: reach },
        { onConflict: "cuenta_id,fecha" },
      );

      const media = await getIgMedia(cuenta.external_id, token, 50);
      const insights = await Promise.all(media.map((m) => getMediaInsights(m, token)));
      const rows = media.map((m, i) => ({
        cuenta_id: cuenta.id, media_id: m.id,
        tipo: m.media_product_type ?? m.media_type ?? null,
        permalink: m.permalink ?? null, caption: m.caption ?? null,
        thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
        publicado_at: m.timestamp ?? null,
        likes: m.like_count ?? 0, comentarios: m.comments_count ?? 0,
        guardados: insights[i].saved ?? 0, compartidos: insights[i].shares ?? 0,
        alcance: insights[i].reach ?? 0, reproducciones: insights[i].views ?? 0,
        actualizado_at: new Date().toISOString(),
      }));
      if (rows.length) await sb.from("social_posts").upsert(rows, { onConflict: "cuenta_id,media_id" });

      results.push({ ok: true, cuenta: cuenta.nombre, posts: rows.length, seguidores: acc.followers_count ?? null });
    } catch (e) {
      results.push({ ok: false, cuenta: cuenta.nombre, error: e instanceof Error ? e.message : "Error desconocido" });
    }
  }
  return results;
}
