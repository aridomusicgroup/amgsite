import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCatalog } from "@/lib/catalog";
import rawBeats from "@/data/beats-beatstars.json";
import driveLinks from "@/data/drive-links.json";
import { overridesCarpetas } from "@/lib/beat-carpetas";

export const dynamic = "force-dynamic";

// ids de los beats originales (archivo JSON). No se pueden borrar de un archivo
// estático → se ocultan con una fila inactiva en la tabla.
const originalIds = new Set((rawBeats as Array<{ id: string }>).map((b) => b.id));

// carpetas de Drive de los beats originales (archivo estático)
const jsonFolders = driveLinks as Record<string, { driveFolderId?: string }>;

// ── GET: TODO el catálogo (originales + agregados), con su origen y salud ──────
export async function GET() {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { beats } = await getCatalog();

  // Salud de ENTREGA: ¿el beat tiene carpeta de Drive de dónde sacar los archivos?
  // Sin carpeta = se vende pero el cliente paga y NO recibe descarga.
  //  - original (JSON): carpeta en data/drive-links.json
  //  - agregado (DB):   columna drive_folder_id de la tabla `beats`
  const dbFolders = new Map<string, boolean>();
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.from("beats").select("id, drive_folder_id");
    for (const r of data ?? []) dbFolders.set(r.id, Boolean(r.drive_folder_id));
  } catch {
    /* sin DB → los agregados quedarán como sin-carpeta (conservador) */
  }

  // Encima de las dos fuentes: la carpeta asignada a mano desde el panel.
  const manual = await overridesCarpetas();

  const list = beats.map((b) => {
    const esOriginal = originalIds.has(b.id);
    const tieneCarpeta =
      manual.has(b.id) ||
      (esOriginal ? Boolean(jsonFolders[b.id]?.driveFolderId) : dbFolders.get(b.id) === true);
    return {
      id: b.id,
      title: b.title,
      bpm: b.bpm,
      key: b.key,
      genre: b.genre,
      price: b.price,
      artworkUrl: b.artworkUrl,
      url: b.url,
      beatstarsUrl: b.beatstarsUrl,
      source: esOriginal ? "original" : "agregado",
      entrega: tieneCarpeta ? "ok" : "sin_carpeta",
      // Sin audio el botón de play de la tienda manda a BeatStars en vez de
      // sonar. Pasa cuando el beat se agrega antes de que BeatStars termine de
      // convertirlo, y nada volvía a revisarlo.
      audio: Boolean(b.hlsUrl),
    };
  });

  return NextResponse.json({ beats: list, total: list.length });
}

// ── DELETE: quita un beat del catálogo ────────────────────────────────────────
// - agregado (DB): borra la fila.
// - original (JSON): lo oculta con una fila inactiva (reversible desde Supabase).
export async function DELETE(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const sb = supabaseAdmin();

  if (originalIds.has(id)) {
    const { beats } = await getCatalog();
    const title = beats.find((b) => b.id === id)?.title || id;
    const { error } = await sb.from("beats").upsert({ id, title, active: false }, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from("beats").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("catalog", "max"); // la tienda refleja el cambio al instante
  return NextResponse.json({ ok: true });
}
