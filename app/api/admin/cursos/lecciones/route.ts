import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extraerDriveId } from "@/lib/drive-id";

export const dynamic = "force-dynamic";

const TIPOS = ["video", "pdf", "link"];

// ── Agregar una lección a un módulo ──
export async function POST(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const moduloId = String(b.modulo_id || "").trim();
  const titulo = String(b.titulo || "").trim();
  const tipo = TIPOS.includes(b.tipo) ? b.tipo : "video";
  if (!moduloId || !titulo) return NextResponse.json({ error: "Faltan datos (módulo o título)." }, { status: 400 });

  const driveFileId = tipo !== "link" && b.drive_link ? extraerDriveId(String(b.drive_link)) : null;
  if (tipo !== "link" && b.drive_link && !driveFileId) {
    return NextResponse.json({ error: "No se pudo leer el ID de ese link de Drive." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: ult } = await sb.from("curso_lecciones").select("orden").eq("modulo_id", moduloId).order("orden", { ascending: false }).limit(1);
  const orden = (Number(ult?.[0]?.orden) || 0) + 1;

  const { data, error } = await sb.from("curso_lecciones").insert({
    modulo_id: moduloId,
    titulo,
    tipo,
    drive_file_id: driveFileId,
    url_externa: tipo === "link" && b.url_externa ? String(b.url_externa).trim() : null,
    duracion_seg: b.duracion_seg ? Number(b.duracion_seg) : null,
    orden,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}

// ── Editar / reordenar lecciones ──
export async function PATCH(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  if (Array.isArray(b.orden_ids)) {
    const ids = b.orden_ids.filter((x: unknown): x is string => typeof x === "string");
    if (!ids.length) return NextResponse.json({ error: "Orden inválido." }, { status: 400 });
    await Promise.all(ids.map((id: string, i: number) => sb.from("curso_lecciones").update({ orden: i }).eq("id", id)));
    return NextResponse.json({ ok: true });
  }

  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id de la lección." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (b.titulo && String(b.titulo).trim()) patch.titulo = String(b.titulo).trim();
  if (b.tipo && TIPOS.includes(b.tipo)) patch.tipo = b.tipo;
  if ("drive_link" in b) {
    const driveFileId = b.drive_link ? extraerDriveId(String(b.drive_link)) : null;
    if (b.drive_link && !driveFileId) return NextResponse.json({ error: "No se pudo leer el ID de ese link de Drive." }, { status: 400 });
    patch.drive_file_id = driveFileId;
  }
  if ("url_externa" in b) patch.url_externa = b.url_externa ? String(b.url_externa).trim() : null;
  if ("duracion_seg" in b) patch.duracion_seg = b.duracion_seg ? Number(b.duracion_seg) : null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  const { error } = await sb.from("curso_lecciones").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Borrar una lección ──
export async function DELETE(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id de la lección." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("curso_lecciones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
