import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchBeatFromBeatStars } from "@/lib/beats-fetch";
import { findSubfolders, findBeatFolderByName } from "@/lib/drive-api";
import { cleanTitle } from "@/lib/beatstars";
import rawBeats from "@/data/beats-beatstars.json";

const catalogIds = new Set((rawBeats as Array<{ id: string }>).map((b) => b.id));

/** Extrae el ID de carpeta de un link de Drive (o un ID suelto). */
function driveFolderId(input?: string): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/) || s.match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

// ── GET: lista de beats agregados desde el admin ──────────────────────────────
export async function GET() {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("beats")
    .select("id, title, bpm, key, price, beatstars_url, drive_folder_id, hls_url, active, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ beats: data ?? [] });
}

// ── POST: agregar un beat por su link de BeatStars ────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { link, bpm, key, genre, driveLink } = body || {};
  if (!link) return NextResponse.json({ error: "Falta el link de BeatStars." }, { status: 400 });

  let beat;
  try {
    beat = await fetchBeatFromBeatStars(String(link));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  // Candado: este beat ya está en el catálogo original (no hace falta agregarlo)
  if (catalogIds.has(beat.id)) {
    return NextResponse.json(
      { error: `Este beat ya está en el catálogo ("${beat.title}"). No hace falta agregarlo.` },
      { status: 409 }
    );
  }

  // Resolver carpeta de Drive + subcarpetas MP3/WAV/STEMS (Drive API)
  let folderId = driveFolderId(driveLink);
  let subfolders: Record<string, string> | null = null;
  try {
    if (folderId) {
      subfolders = await findSubfolders(folderId);
    } else {
      const found = await findBeatFolderByName(cleanTitle(beat.title));
      if (found) {
        folderId = found;
        subfolders = await findSubfolders(found);
      }
    }
  } catch {
    /* sin Drive API o sin permiso → se guarda sin carpeta (se puede reintentar) */
  }

  const sb = supabaseAdmin();
  const row = {
    id: beat.id,
    title: beat.title,
    bpm: Number(bpm) || 0,
    key: key ? String(key).trim() : null,
    genres: [String(genre || "LATIN")],
    price: beat.price,
    plays: 0,
    likes: 0,
    tags: beat.tags,
    artwork_url: beat.artworkUrl,
    artwork_large: beat.artworkLarge,
    preview_url: null,
    hls_url: beat.hlsUrl,
    waveform_url: beat.waveformUrl,
    beatstars_url: beat.beatstarsUrl,
    drive_folder_id: folderId,
    drive_subfolders: subfolders,
    active: true,
  };

  const { error } = await sb.from("beats").upsert(row, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidateTag("catalog", "max"); // el beat nuevo aparece en la tienda al instante
  return NextResponse.json({
    ok: true,
    beat: { id: beat.id, title: beat.title },
    // BeatStars convierte el audio DESPUÉS de subirlo. Si agregas el beat a los
    // minutos, `streamUrl` todavía viene vacío y se guardaría mudo para siempre:
    // en la tienda el botón de play acabaría mandando a BeatStars.
    sinAudio: !beat.hlsUrl,
  });
}

// ── PATCH: reintentar la carpeta de Drive de un beat agregado ─────────────────
// Útil cuando el beat se subió antes de tener la carpeta lista: re-resuelve la
// carpeta (por link pegado o por nombre) sin borrar y volver a crear el beat.
export async function PATCH(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, driveLink } = body || {};
  if (!id) return NextResponse.json({ error: "Falta id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: row } = await sb.from("beats").select("id, title").eq("id", String(id)).maybeSingle();
  if (!row) {
    return NextResponse.json(
      { error: "Solo se puede editar un beat agregado desde el panel (los originales viven en el catálogo)." },
      { status: 404 }
    );
  }

  // Volver a pedirle a BeatStars el audio (y de paso portada, waveform y precio).
  //
  // Hace falta porque BeatStars CONVIERTE EL AUDIO DESPUÉS de que subes el beat:
  // si lo agregas al panel a los minutos, `streamUrl` viene vacío y se guarda
  // null para siempre — nada volvía a revisarlo. En la tienda ese beat queda
  // mudo y el botón de play manda a BeatStars, que fue justo lo que pasó con
  // "EL CHICO TEMIDO".
  if (body.resync) {
    let fresco;
    try {
      fresco = await fetchBeatFromBeatStars(String(id));
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }

    const { error } = await sb
      .from("beats")
      .update({
        hls_url: fresco.hlsUrl,
        waveform_url: fresco.waveformUrl,
        artwork_url: fresco.artworkUrl,
        artwork_large: fresco.artworkLarge,
        price: fresco.price,
      })
      .eq("id", String(id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    revalidateTag("catalog", "max"); // que suene en la tienda ya
    return NextResponse.json({
      ok: true,
      audio: Boolean(fresco.hlsUrl),
      mensaje: fresco.hlsUrl
        ? "Audio listo: ya se puede reproducir en la tienda."
        : "BeatStars todavía no termina de convertir el audio. Espera unos minutos y vuelve a intentar.",
    });
  }

  // Editar la ficha (BPM, tonalidad, género) sin tocar la carpeta de Drive.
  //
  // Hace falta porque BeatStars ya NO manda estos datos por su API pública
  // (`bpm` regresa null y `key` ni existe como campo), así que se capturan a
  // mano — y hasta ahora, si se te olvidaba llenarlos al agregar el beat, la
  // única salida era borrarlo y volverlo a subir.
  const ficha: Record<string, unknown> = {};
  if ("bpm" in body) ficha.bpm = Math.max(0, Math.min(400, Number(body.bpm) || 0));
  if ("key" in body) ficha.key = String(body.key || "").trim() || null;
  if ("genre" in body) {
    const g = String(body.genre || "").trim();
    if (g) ficha.genres = [g];
  }
  if (Object.keys(ficha).length > 0) {
    const { error } = await sb.from("beats").update(ficha).eq("id", String(id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Si solo venía la ficha, se termina aquí: no hay por qué ir a Drive.
    if (!("driveLink" in body)) return NextResponse.json({ ok: true, actualizado: Object.keys(ficha) });
  }

  let folderId = driveFolderId(driveLink);
  let subfolders: Record<string, string> | null = null;
  try {
    if (folderId) {
      subfolders = await findSubfolders(folderId);
    } else {
      const found = await findBeatFolderByName(cleanTitle(row.title as string));
      if (found) {
        folderId = found;
        subfolders = await findSubfolders(found);
      }
    }
  } catch {
    /* sin Drive API o sin permiso */
  }

  if (!folderId) {
    return NextResponse.json(
      { error: "No se encontró la carpeta automáticamente. Pega el link de la carpeta de Drive." },
      { status: 400 }
    );
  }

  const { error } = await sb
    .from("beats")
    .update({ drive_folder_id: folderId, drive_subfolders: subfolders })
    .eq("id", String(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, subcarpetas: Boolean(subfolders) });
}

// ── DELETE: quitar un beat agregado ───────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const sb = supabaseAdmin();
  const { error } = await sb.from("beats").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag("catalog", "max");
  return NextResponse.json({ ok: true });
}
