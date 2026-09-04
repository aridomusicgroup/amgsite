import { NextRequest, NextResponse } from "next/server";
import { getMusicoId } from "@/lib/musico-auth";
import { getMusico, asignacionDeMusico } from "@/lib/musico-data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad } from "@/lib/actividad";
import { pushAResponsables, destinoProyecto, conProyecto } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLASES = ["previo", "stem"] as const;
const MAX_NOMBRE = 200;

/**
 * Registra lo que el músico acaba de subir a Drive y avisa al equipo.
 *
 * A diferencia del portal de clientes —donde este paso es un aviso y ya— aquí
 * es la pieza central: es lo que crea la fila de `musico_archivos`, que es lo
 * que hace que `reaper-sync` baje la pista y que aparezca el botón de aprobar
 * el previo. Sin esta llamada el archivo existe en Drive y para nadie más.
 *
 * El archivo NO se comparte con el cliente aquí. Un previo entra sin aprobar; la
 * puerta al cliente es `render_jobs.compartir`, y eso lo prende una persona del
 * estudio desde el panel.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const musicoId = await getMusicoId();
  if (!musicoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const musico = await getMusico(musicoId);
  if (!musico) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!rateLimit(`musubida:${musicoId}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas subidas seguidas. Espera unos minutos." }, { status: 429 });
  }

  const { id } = await ctx.params;
  const asig = await asignacionDeMusico(musicoId, id);
  if (!asig) return NextResponse.json({ error: "Esa asignación no es tuya." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const clase = String(b.clase || "");
  const nombre = String(b.nombre || "").trim().slice(0, MAX_NOMBRE);
  const driveId = String(b.driveId || "").trim();
  const bytes = Number(b.bytes);

  if (!(CLASES as readonly string[]).includes(clase)) {
    return NextResponse.json({ error: "Tipo de archivo desconocido." }, { status: 400 });
  }
  if (!nombre || !driveId) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  // Mismo criterio que el portal: un previo que no sea mp3 no se puede
  // reproducir en el panel del cliente, y una pista que no sea wav no sirve
  // para mezclar. Se revalida aquí porque la del navegador es una comodidad.
  if (clase === "previo" && !/\.mp3$/i.test(nombre)) {
    return NextResponse.json({ error: "El previo tiene que ser un MP3." }, { status: 400 });
  }
  if (clase === "stem" && !/\.wav$/i.test(nombre)) {
    return NextResponse.json({ error: "La pista tiene que ser un WAV." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("musico_archivos").insert({
    asignacion_id: asig.id,
    clase,
    nombre,
    drive_id: driveId,
    bytes: Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Una pista entregada mueve la asignación; un previo es un avance, no la entrega.
  if (clase === "stem") {
    await sb.from("musico_asignaciones")
      .update({ estado: "entregado", updated_at: new Date().toISOString() })
      .eq("id", asig.id);
  }

  const { data: proy } = await sb.from("proyectos")
    .select("titulo, responsables, responsable_id")
    .eq("id", asig.proyectoId)
    .maybeSingle();

  const que = clase === "previo" ? "un previo" : `su pista de ${asig.instrumento}`;
  const texto = `${musico.nombre} subió ${que}`;

  await registrarActividad(sb, {
    tipo: "musico_archivo",
    titulo: texto,
    actor: musico.email ?? null,
    proyecto_id: asig.proyectoId,
    tarea_id: asig.tareaId,
    // Sin `entidad` a propósito: "musico" está en ENTIDADES_SENSIBLES (por los
    // pagos), y marcarlo así escondería este aviso justo de Diego y Leo, que
    // son quienes tienen que enterarse. Con proyecto_id basta para que caiga en
    // la bitácora de Producción.
    meta: { clase, nombre, instrumento: asig.instrumento, musico: musico.nombre },
  });

  const responsables = [
    ...(((proy?.responsables as string[] | null) ?? []) as string[]),
    (proy?.responsable_id as string | null) ?? null,
  ];
  await pushAResponsables(sb, responsables, {
    titulo: "ARIDO · Producción",
    cuerpo: conProyecto((proy?.titulo as string | null) ?? null, texto),
    url: destinoProyecto(asig.proyectoId),
  });

  return NextResponse.json({ ok: true });
}
