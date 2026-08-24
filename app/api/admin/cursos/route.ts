import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugDisponible } from "@/lib/cursos-admin";
import { extraerDriveId } from "@/lib/drive-id";

export const dynamic = "force-dynamic";

// ── Crear curso ──
export async function POST(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const titulo = String(b.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "Falta el título." }, { status: 400 });

  const slug = await slugDisponible(titulo);
  const driveFolderId = b.drive_folder ? extraerDriveId(String(b.drive_folder)) : null;

  const sb = supabaseAdmin();
  const { data, error } = await sb.from("cursos").insert({
    slug,
    titulo,
    descripcion: b.descripcion ? String(b.descripcion).trim() : null,
    precio_mxn: b.precio_mxn ? Number(b.precio_mxn) : null,
    portada_url: b.portada_url ? String(b.portada_url).trim() : null,
    drive_folder_id: driveFolderId,
    activo: true,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data?.id });
}

// ── Editar curso ──
export async function PATCH(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del curso." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.titulo && String(b.titulo).trim()) patch.titulo = String(b.titulo).trim();
  if ("descripcion" in b) patch.descripcion = b.descripcion ? String(b.descripcion).trim() : null;
  if ("precio_mxn" in b) patch.precio_mxn = b.precio_mxn ? Number(b.precio_mxn) : null;
  if ("portada_url" in b) patch.portada_url = b.portada_url ? String(b.portada_url).trim() : null;
  if ("activo" in b) patch.activo = Boolean(b.activo);
  if ("drive_folder" in b) patch.drive_folder_id = b.drive_folder ? extraerDriveId(String(b.drive_folder)) : null;

  const sb = supabaseAdmin();
  const { error } = await sb.from("cursos").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Borrar curso (en cascada: módulos, lecciones, accesos, progreso) ──
export async function DELETE(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del curso." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("cursos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
