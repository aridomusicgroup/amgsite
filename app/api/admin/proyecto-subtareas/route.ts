import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombresPorId, nombreDeActor } from "@/lib/actividad";
import { pushAResponsables, contextoProyecto, conProyecto, destinoTarea } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Reordena las subtareas de una tarea (reasigna `orden` secuencial, en paralelo). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reordenarSubtareas(sb: any, ids: unknown[]) {
  const limpio = ids.map((x) => String(x)).filter(Boolean);
  await Promise.all(limpio.map((id, i) => sb.from("proyecto_subtareas").update({ orden: i }).eq("id", id)));
  return NextResponse.json({ ok: true });
}

/** proyecto_id de una tarea (para ligar la actividad al proyecto). Best-effort. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function proyectoDeTarea(sb: any, tareaId: string): Promise<string | null> {
  try {
    const { data } = await sb.from("proyecto_tareas").select("proyecto_id").eq("id", tareaId).single();
    return (data?.proyecto_id as string) ?? null;
  } catch {
    return null;
  }
}

// ── Agregar subtarea ──
export async function POST(req: NextRequest) {
  const email = await getProduccionEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const tareaId = String(b.tarea_id || "").trim();
  const titulo = String(b.titulo || "").trim();
  const responsableId = b.responsable_id ? String(b.responsable_id) : null;
  if (!tareaId || !titulo) return NextResponse.json({ error: "Faltan datos (tarea o título)." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: ult } = await sb.from("proyecto_subtareas").select("orden").eq("tarea_id", tareaId).order("orden", { ascending: false }).limit(1);
  const orden = (Number(ult?.[0]?.orden) || 0) + 1;

  const { error } = await sb.from("proyecto_subtareas").insert({ tarea_id: tareaId, titulo, hecho: false, orden, responsable_id: responsableId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bitácora: solo si la subtarea nace con responsable asignado
  if (responsableId) {
    try {
      const quien = await nombreDeActor(sb, email);
      const nombres = await nombresPorId(sb, [responsableId]);
      const proyId = await proyectoDeTarea(sb, tareaId);
      const ctx = await contextoProyecto(sb, proyId);
      await registrarActividad(sb, {
        tipo: "subtarea_asignada",
        titulo: `${quien} asignó la subtarea “${titulo}” a ${nombres[responsableId] || "—"}`,
        actor: email, proyecto_id: proyId, tarea_id: tareaId,
        entidad: "tarea", entidad_id: tareaId, entidad_nombre: ctx.titulo,
        meta: { responsable_id: responsableId },
      });
      await pushAResponsables(sb, [responsableId], {
        titulo: "Subtarea asignada",
        cuerpo: conProyecto(ctx.titulo, `Te asignaron: ${titulo}`),
        // La subtarea vive dentro de la ventana de su tarea: ahí se abre.
        url: destinoTarea(tareaId),
      });
    } catch { /* bitácora best-effort */ }
  }

  return NextResponse.json({ ok: true });
}

// ── Marcar hecho / editar subtarea ──
export async function PATCH(req: NextRequest) {
  const email = await getProduccionEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));

  // Reordenar: no toca campos, solo el `orden`.
  if (Array.isArray(b.orden_ids)) {
    return reordenarSubtareas(supabaseAdmin(), b.orden_ids);
  }

  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ("hecho" in b) patch.hecho = Boolean(b.hecho);
  if (b.titulo && String(b.titulo).trim()) patch.titulo = String(b.titulo).trim();
  if ("responsable_id" in b) patch.responsable_id = b.responsable_id ? String(b.responsable_id) : null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  const sb = supabaseAdmin();
  // Estado previo: registrar SOLO reasignación de responsable
  const { data: prev } = await sb.from("proyecto_subtareas")
    .select("titulo, responsable_id, tarea_id").eq("id", id).single();
  const { error } = await sb.from("proyecto_subtareas").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bitácora: solo asignación de subtarea (no el marcar/desmarcar hecho → sería ruido)
  try {
    if ("responsable_id" in patch && (patch.responsable_id ?? null) !== (prev?.responsable_id ?? null) && patch.responsable_id) {
      const quien = await nombreDeActor(sb, email);
      const nombres = await nombresPorId(sb, [patch.responsable_id as string]);
      const subTitulo = (patch.titulo as string) || (prev?.titulo as string) || "subtarea";
      const proyId = prev?.tarea_id ? await proyectoDeTarea(sb, prev.tarea_id as string) : null;
      const ctx = await contextoProyecto(sb, proyId);
      await registrarActividad(sb, {
        tipo: "subtarea_asignada",
        titulo: `${quien} asignó la subtarea “${subTitulo}” a ${nombres[patch.responsable_id as string] || "—"}`,
        actor: email,
        proyecto_id: proyId,
        tarea_id: (prev?.tarea_id as string) ?? null,
        entidad: "tarea", entidad_id: (prev?.tarea_id as string) ?? null, entidad_nombre: ctx.titulo,
        meta: { responsable_id: patch.responsable_id },
      });
      await pushAResponsables(sb, [patch.responsable_id as string], {
        titulo: "Subtarea asignada",
        cuerpo: conProyecto(ctx.titulo, `Te asignaron: ${subTitulo}`),
        url: prev?.tarea_id ? destinoTarea(prev.tarea_id as string) : ctx.url,
      });
    }
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}

// ── Borrar subtarea ──
export async function DELETE(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("proyecto_subtareas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
