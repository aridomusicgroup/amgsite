import { NextRequest, NextResponse } from "next/server";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { extraerDriveId } from "@/lib/drive-id";
import {
  CTAS, ESTADOS_PRODUCCION, ETIQUETAS, TIPOS_LECCION, esUno,
  sanitizarContenido, validarMarcadores, validarRecursos,
} from "@/lib/cursos-tipos";

export const dynamic = "force-dynamic";

/** Link o ID de Drive → ID; `undefined` = venía algo pero no se pudo leer. */
function driveId(v: unknown): string | null | undefined {
  if (!v) return null;
  return extraerDriveId(String(v)) ?? undefined;
}

/** Los recursos llegan con link o ID de Drive: se guardan sólo con el ID. */
function recursosDe(v: unknown) {
  if (!Array.isArray(v)) return [];
  return validarRecursos(
    v.map((r) => (typeof r === "object" && r !== null
      ? { ...r, drive_file_id: extraerDriveId(String((r as Record<string, unknown>).drive_file_id ?? "")) ?? "" }
      : r)),
  );
}

// ── Agregar una lección a un módulo ──
export async function POST(req: NextRequest) {
  if (!(await moduloPermitido("/admin/cursos"))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const moduloId = String(b.modulo_id || "").trim();
  const titulo = String(b.titulo || "").trim().slice(0, 200);
  const tipo = esUno(TIPOS_LECCION, b.tipo) ? b.tipo : "video";
  if (!moduloId || !titulo) return NextResponse.json({ error: "Faltan datos (módulo o título)." }, { status: 400 });

  const archivo = tipo !== "link" ? driveId(b.drive_link) : null;
  if (archivo === undefined) return NextResponse.json({ error: "No se pudo leer el ID de ese link de Drive." }, { status: 400 });

  const urlExterna = (tipo === "link" || tipo === "en_vivo") && b.url_externa ? String(b.url_externa).trim() : null;
  if (urlExterna && !/^https:\/\//i.test(urlExterna)) return NextResponse.json({ error: "El enlace tiene que empezar con https://" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: ult } = await sb.from("curso_lecciones").select("orden").eq("modulo_id", moduloId).order("orden", { ascending: false }).limit(1);
  const orden = (Number(ult?.[0]?.orden) || 0) + 1;

  const fila: Record<string, unknown> = {
    modulo_id: moduloId,
    titulo,
    tipo,
    drive_file_id: archivo,
    url_externa: urlExterna,
    duracion_seg: b.duracion_seg ? Number(b.duracion_seg) : null,
    orden,
  };
  if (esUno(ETIQUETAS, b.etiqueta)) fila.etiqueta = b.etiqueta;
  // Una lección nueva hecha a mano nace publicada sólo si ya trae su material.
  if (typeof b.publicada === "boolean") fila.publicada = b.publicada;

  let { data, error } = await sb.from("curso_lecciones").insert(fila).select("id").single();
  if (error && /column/i.test(error.message)) {
    // SQL v2 sin correr: guarda lo básico.
    const { etiqueta: _e, publicada: _p, ...basico } = fila;
    ({ data, error } = await sb.from("curso_lecciones").insert(basico).select("id").single());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}

// ── Editar / reordenar / mover lecciones ──
export async function PATCH(req: NextRequest) {
  if (!(await moduloPermitido("/admin/cursos"))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  if (Array.isArray(b.orden_ids)) {
    const ids = b.orden_ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 200);
    if (!ids.length) return NextResponse.json({ error: "Orden inválido." }, { status: 400 });
    await Promise.all(ids.map((id: string, i: number) => sb.from("curso_lecciones").update({ orden: i }).eq("id", id)));
    return NextResponse.json({ ok: true });
  }

  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id de la lección." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (b.titulo && String(b.titulo).trim()) patch.titulo = String(b.titulo).trim().slice(0, 200);
  if (esUno(TIPOS_LECCION, b.tipo)) patch.tipo = b.tipo;
  if ("drive_link" in b) {
    const archivo = driveId(b.drive_link);
    if (archivo === undefined) return NextResponse.json({ error: "No se pudo leer el ID de ese link de Drive." }, { status: 400 });
    patch.drive_file_id = archivo;
  }
  if ("url_externa" in b) {
    const url = b.url_externa ? String(b.url_externa).trim() : null;
    if (url && !/^https:\/\//i.test(url)) return NextResponse.json({ error: "El enlace tiene que empezar con https://" }, { status: 400 });
    patch.url_externa = url;
  }
  if ("duracion_seg" in b) patch.duracion_seg = b.duracion_seg ? Math.max(0, Math.floor(Number(b.duracion_seg))) || null : null;
  if (esUno(ETIQUETAS, b.etiqueta)) patch.etiqueta = b.etiqueta;
  if (esUno(CTAS, b.cta)) patch.cta = b.cta;
  if (esUno(ESTADOS_PRODUCCION, b.estado_produccion)) patch.estado_produccion = b.estado_produccion;
  for (const k of ["opcional", "preview", "publicada"] as const) {
    if (typeof b[k] === "boolean") patch[k] = b[k];
  }
  if ("contenido" in b) {
    const c = sanitizarContenido(b.contenido);
    if (JSON.stringify(c).length > 60_000) return NextResponse.json({ error: "El guion es demasiado largo." }, { status: 400 });
    patch.contenido = c;
  }
  if ("marcadores" in b) patch.marcadores = validarMarcadores(b.marcadores);
  if ("recursos" in b) patch.recursos = recursosDe(b.recursos);
  if (typeof b.modulo_id === "string" && b.modulo_id) patch.modulo_id = b.modulo_id;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  const { error } = await sb.from("curso_lecciones").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Borrar una lección ──
export async function DELETE(req: NextRequest) {
  if (!(await moduloPermitido("/admin/cursos"))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id de la lección." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("curso_lecciones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
