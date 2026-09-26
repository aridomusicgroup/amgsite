import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { beatParaPanel } from "@/lib/catalog";
import { canalDeUrl, idYoutube, limpiarUrl, type Canal } from "@/lib/beat-ficha";
import { registrarActividad } from "@/lib/actividad";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const ID_VALIDO = /^[A-Za-z0-9_-]{2,40}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const CANALES: Canal[] = ["youtube", "instagram", "tiktok", "facebook", "otro"];
const NOMBRE_CANAL: Record<Canal, string> = {
  youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", otro: "otro lado",
};

/**
 * Título y miniatura de un video de YouTube sin API key (oEmbed). La petición
 * va SIEMPRE a youtube.com; el link del usuario sólo viaja como parámetro.
 */
async function datosYoutube(url: string): Promise<{ titulo: string | null; miniatura: string | null }> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return { titulo: null, miniatura: null };
    const j = await r.json();
    return {
      titulo: typeof j.title === "string" ? j.title.slice(0, 200) : null,
      miniatura: typeof j.thumbnail_url === "string" && j.thumbnail_url.startsWith("https://") ? j.thumbnail_url : null,
    };
  } catch {
    return { titulo: null, miniatura: null };
  }
}

async function guardia(params: Props["params"]) {
  const email = await moduloPermitido("/admin/beats");
  if (!email) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  const { id } = await params;
  if (!ID_VALIDO.test(id)) return { error: NextResponse.json({ error: "Beat inválido." }, { status: 400 }) };
  return { email, id };
}

/** Registrar en qué video / reel salió el beat (pegando el link o eligiendo un reel ya sincronizado). */
export async function POST(req: NextRequest, { params }: Props) {
  const g = await guardia(params);
  if ("error" in g) return g.error;
  const { email, id } = g;
  if (!rateLimit(`beat-pub:${email}`, 30, 60_000)) {
    return NextResponse.json({ error: "Demasiados cambios seguidos. Espera un momento." }, { status: 429 });
  }

  const beat = await beatParaPanel(id);
  if (!beat) return NextResponse.json({ error: "Ese beat no existe." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  let fila: Record<string, unknown>;
  if (body?.social_post_id) {
    // Un reel que ya sincronizamos: todo sale de ahí, el navegador sólo manda el id.
    if (!UUID.test(String(body.social_post_id))) return NextResponse.json({ error: "Reel inválido." }, { status: 400 });
    const { data: post } = await sb.from("social_posts")
      .select("id, permalink, caption, thumbnail_url, publicado_at").eq("id", body.social_post_id).maybeSingle();
    if (!post?.permalink) return NextResponse.json({ error: "No encontré ese reel." }, { status: 404 });
    fila = {
      canal: "instagram",
      url: post.permalink,
      titulo: String(post.caption ?? "").split("\n")[0].slice(0, 200) || null,
      miniatura: post.thumbnail_url ?? null,
      publicado_at: post.publicado_at ? String(post.publicado_at).slice(0, 10) : null,
      social_post_id: post.id,
    };
  } else {
    const url = limpiarUrl(body?.url);
    if (!url) return NextResponse.json({ error: "Pega el link completo del video o del post." }, { status: 400 });
    const detectado = canalDeUrl(url);
    const canal: Canal = detectado !== "otro" ? detectado : CANALES.includes(body?.canal) ? body.canal : "otro";
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.publicado_at ?? "")) ? body.publicado_at : null;
    fila = { canal, url, titulo: null, miniatura: null, publicado_at: fecha, social_post_id: null };

    if (canal === "youtube") {
      if (!idYoutube(url)) return NextResponse.json({ error: "Ese link de YouTube no es de un video." }, { status: 400 });
      Object.assign(fila, await datosYoutube(url));
    }
    if (canal === "instagram") {
      // Si ese post ya está sincronizado, se liga para traer sus números. Se
      // busca por su código (/reel/<código>/): el link pegado puede venir con o
      // sin "www." y con parámetros de rastreo.
      const codigo = new URL(url).pathname.match(/^\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/)?.[1];
      const { data: post } = codigo
        ? await sb.from("social_posts")
          .select("id, permalink, caption, thumbnail_url, publicado_at").ilike("permalink", `%/${codigo}/%`).limit(1).maybeSingle()
        : { data: null };
      if (post) {
        Object.assign(fila, {
          url: post.permalink ?? url,
          social_post_id: post.id,
          titulo: String(post.caption ?? "").split("\n")[0].slice(0, 200) || null,
          miniatura: post.thumbnail_url ?? null,
          publicado_at: fila.publicado_at ?? (post.publicado_at ? String(post.publicado_at).slice(0, 10) : null),
        });
      }
    }
    const titulo = String(body?.titulo ?? "").trim().slice(0, 200);
    if (titulo) fila.titulo = titulo;
  }

  const { data, error } = await sb.from("beat_publicaciones")
    .insert({ beat_id: id, ...fila, creado_por: email }).select("id").single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ error: "Ese link ya está registrado en este beat." }, { status: 409 });
    if (/beat_publicaciones/i.test(error.message) && /(does not exist|schema cache)/i.test(error.message)) {
      return NextResponse.json({ error: "Falta correr supabase-beat-ficha.sql en Supabase." }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await registrarActividad(sb, {
    tipo: "beat_publicacion", titulo: `${beat.beat.title} salió en ${NOMBRE_CANAL[fila.canal as Canal]}`, actor: email,
    entidad: "beat", entidad_id: id, entidad_nombre: beat.beat.title, meta: { url: fila.url },
  });
  return NextResponse.json({ ok: true, id: data.id });
}

/** Mostrar (o no) el video de YouTube en la página pública del beat. Sólo uno a la vez. */
export async function PATCH(req: NextRequest, { params }: Props) {
  const g = await guardia(params);
  if ("error" in g) return g.error;
  const body = await req.json().catch(() => ({}));
  const pub = String(body?.pub ?? "");
  if (!UUID.test(pub) || typeof body?.mostrar_en_tienda !== "boolean") {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const { data: fila } = await sb.from("beat_publicaciones").select("canal").eq("id", pub).eq("beat_id", g.id).maybeSingle();
  if (!fila) return NextResponse.json({ error: "No existe." }, { status: 404 });
  if (fila.canal !== "youtube") return NextResponse.json({ error: "Sólo los videos de YouTube se pueden mostrar en la tienda." }, { status: 400 });

  if (body.mostrar_en_tienda) {
    await sb.from("beat_publicaciones").update({ mostrar_en_tienda: false }).eq("beat_id", g.id).neq("id", pub);
  }
  const { error } = await sb.from("beat_publicaciones").update({ mostrar_en_tienda: body.mostrar_en_tienda }).eq("id", pub);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag("catalog", { expire: 0 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const g = await guardia(params);
  if ("error" in g) return g.error;
  const pub = new URL(req.url).searchParams.get("pub") ?? "";
  if (!UUID.test(pub)) return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  const { error } = await supabaseAdmin().from("beat_publicaciones").delete().eq("id", pub).eq("beat_id", g.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag("catalog", { expire: 0 });
  return NextResponse.json({ ok: true });
}
