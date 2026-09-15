import { NextRequest, NextResponse } from "next/server";
import { getMusicoId } from "@/lib/musico-auth";
import { getMusico, asignacionDeMusico } from "@/lib/musico-data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad } from "@/lib/actividad";
import { rateLimit } from "@/lib/rate-limit";
import { retirarArchivo } from "@/lib/musico-pistas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * El músico quita un archivo que subió por error (Jorge mandó su trombón al
 * proyecto equivocado). Sólo los suyos, y sólo mientras no haya entrado al
 * proyecto de REAPER: a partir de ahí ya es trabajo del estudio.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const musicoId = await getMusicoId();
  if (!musicoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const musico = await getMusico(musicoId);
  if (!musico) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!rateLimit(`muborra:${musicoId}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiados cambios seguidos. Espera unos minutos." }, { status: 429 });
  }

  const { id } = await ctx.params;
  const asig = await asignacionDeMusico(musicoId, id);
  if (!asig) return NextResponse.json({ error: "Esa asignación no es tuya." }, { status: 404 });

  const archivoId = String(new URL(req.url).searchParams.get("archivo") || "").trim();
  if (!UUID.test(archivoId)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });

  const sb = supabaseAdmin();
  // El candado de propiedad: el archivo tiene que ser de ESTA asignación.
  const { data: a } = await sb.from("musico_archivos").select("asignacion_id").eq("id", archivoId).maybeSingle();
  if (!a || a.asignacion_id !== asig.id) return NextResponse.json({ error: "Ese archivo no es tuyo." }, { status: 404 });

  const actor = musico.email ?? `musico:${musico.nombre}`;
  const r = await retirarArchivo(sb, archivoId, { actor, puedeImportado: false });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  await registrarActividad(sb, {
    tipo: "musico_archivo_retirado",
    titulo: `${musico.nombre} quitó "${r.nombre}"${r.reabierta ? ` — “${r.reabierta}” se reabrió` : ""}`,
    actor: musico.email ?? null,
    proyecto_id: asig.proyectoId,
    tarea_id: asig.tareaId,
    meta: { archivo: r.nombre, modo: r.modo, instrumento: asig.instrumento, musico: musico.nombre },
  });

  return NextResponse.json({ ok: true, modo: r.modo, reabierta: r.reabierta });
}
