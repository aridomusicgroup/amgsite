import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad } from "@/lib/actividad";
import { renderListoEmail } from "@/lib/emails";
import { DOMAINS } from "@/lib/site";
import { retirarArchivo } from "@/lib/musico-pistas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lo que subieron los músicos de un proyecto, y el visto bueno para que un
 * previo llegue al cliente.
 */

// ── GET: los archivos de un proyecto ──
export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const proyectoId = new URL(req.url).searchParams.get("proyecto_id");
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: asigs } = await sb.from("musico_asignaciones")
    .select("id, instrumento, musicos(nombre)")
    .eq("proyecto_id", proyectoId);
  if (!asigs?.length) return NextResponse.json({ archivos: [] });

  const porAsig = new Map(asigs.map((a) => [
    a.id as string,
    {
      instrumento: a.instrumento as string,
      musico: (a.musicos as unknown as { nombre: string } | null)?.nombre ?? "—",
    },
  ]));

  // `retirar_at` es columna nueva: sin ella, la lista sale igual (sin ese estado).
  const COLS = "id, asignacion_id, clase, nombre, bytes, subido_at, aprobado_at, bajado_at, importado_at, pista, error";
  const leer = (cols: string) => sb.from("musico_archivos").select(cols)
    .in("asignacion_id", [...porAsig.keys()])
    .order("subido_at", { ascending: false });
  let { data, error } = await leer(`${COLS}, retirar_at`);
  if (error) ({ data, error } = await leer(COLS));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = (data ?? []) as unknown as Record<string, unknown>[];
  return NextResponse.json({
    archivos: filas.map((a) => ({ ...a, ...porAsig.get(a.asignacion_id as string) })),
  });
}

/**
 * DELETE: el estudio quita un archivo de músico, aunque ya haya entrado al
 * proyecto — en ese caso reaper-sync le quita la toma al .rpp (con respaldo, y
 * sólo con ese proyecto cerrado en REAPER).
 */
export async function DELETE(req: NextRequest) {
  const actor = await getProduccionEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = String(new URL(req.url).searchParams.get("id") || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: dueno } = await sb.from("musico_archivos")
    .select("musico_asignaciones(proyecto_id, tarea_id, instrumento, musicos(nombre))").eq("id", id).maybeSingle();
  const asig = dueno?.musico_asignaciones as unknown as
    { proyecto_id: string; tarea_id: string | null; instrumento: string; musicos: { nombre: string } | null } | null;

  const r = await retirarArchivo(sb, id, { actor, puedeImportado: true });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  const musico = asig?.musicos?.nombre ?? "un músico";
  await registrarActividad(sb, {
    tipo: "musico_archivo_retirado",
    titulo: `Se quitó "${r.nombre}" de ${musico}${r.reabierta ? ` — “${r.reabierta}” se reabrió` : ""}`,
    actor,
    proyecto_id: asig?.proyecto_id ?? null,
    tarea_id: asig?.tarea_id ?? null,
    meta: { archivo: r.nombre, modo: r.modo, instrumento: asig?.instrumento ?? null, musico },
  });

  return NextResponse.json({ ok: true, modo: r.modo, reabierta: r.reabierta });
}

/**
 * PATCH: aprobar un previo — el único camino hacia el cliente.
 *
 * No copia ni re-sube nada: crea una fila de `render_jobs` apuntando al MISMO
 * archivo de Drive, con `tipo='previo'` y `compartir=true`. Con eso funciona
 * gratis todo lo que ya existe del lado del cliente (el reproductor, el proxy
 * con Range que nunca le enseña el id de Drive, y su lista de archivos).
 *
 * `origen='musico'` es lo único que lo distingue de un render hecho en REAPER.
 */
export async function PATCH(req: NextRequest) {
  const actor = await getProduccionEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: arch } = await sb.from("musico_archivos")
    .select("id, asignacion_id, clase, nombre, drive_id, aprobado_at")
    .eq("id", id).maybeSingle();
  if (!arch) return NextResponse.json({ error: "Ese archivo ya no existe." }, { status: 404 });
  if (arch.clase !== "previo") {
    return NextResponse.json({ error: "Solo los previos se comparten con el cliente." }, { status: 400 });
  }
  if (arch.aprobado_at) return NextResponse.json({ ok: true, yaEstaba: true });

  const { data: asig } = await sb.from("musico_asignaciones")
    .select("proyecto_id, tarea_id, musico_id, instrumento, musicos(nombre)")
    .eq("id", arch.asignacion_id).maybeSingle();
  if (!asig) return NextResponse.json({ error: "La asignación ya no existe." }, { status: 409 });

  const { data: job, error: eJob } = await sb.from("render_jobs").insert({
    proyecto_id: asig.proyecto_id,
    tarea_id: asig.tarea_id,
    tipo: "previo",
    origen: "musico",
    musico_id: asig.musico_id,
    estado: "listo",
    compartir: true,
    pedido_por: actor,
    drive_urls: [{ archivo: arch.nombre, id: arch.drive_id }],
  }).select("id").single();
  if (eJob) return NextResponse.json({ error: eJob.message }, { status: 500 });

  await sb.from("musico_archivos").update({
    aprobado_at: new Date().toISOString(),
    aprobado_por: actor,
    render_job_id: job.id,
  }).eq("id", id);

  const musico = (asig.musicos as unknown as { nombre: string } | null)?.nombre ?? "el músico";
  await registrarActividad(sb, {
    tipo: "musico_previo_compartido",
    titulo: `Se compartió con el cliente el previo de ${musico} (${asig.instrumento})`,
    actor,
    proyecto_id: asig.proyecto_id as string,
    tarea_id: asig.tarea_id as string | null,
    meta: { musico, archivo: arch.nombre },
  });

  const avisado = await avisarCliente(sb, asig.proyecto_id as string);
  return NextResponse.json({ ok: true, avisado });
}

/** Mismo correo que ya recibe cuando le compartimos un previo nuestro. */
async function avisarCliente(sb: ReturnType<typeof supabaseAdmin>, proyectoId: string): Promise<string | null> {
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    const { data: p } = await sb.from("proyectos")
      .select("titulo, order_id, contactos(nombre, email)")
      .eq("id", proyectoId).maybeSingle();
    const ct = p?.contactos as unknown as { nombre: string | null; email: string | null } | null;
    const correo = String(ct?.email || "").trim().toLowerCase();
    // Sin pedido ligado no hay a dónde mandarlo: el archivo igual ya se ve en su
    // panel si algún día se liga, así que esto no es un error.
    if (!p?.order_id || !correo) return null;

    const mail = renderListoEmail({
      customerName: ct?.nombre?.split(" ")[0] ?? null,
      concepto: (p.titulo as string) || "tu producción",
      tipo: "previo",
      archivos: 1,
      url: `${DOMAINS.main}/cuenta/pedido/${p.order_id}`,
    });
    await new Resend(key).emails.send({
      from: "Latino Gang Beats <acceso@aridomusicgroup.com>",
      to: correo,
      subject: mail.subject,
      html: mail.html,
    });
    return correo;
  } catch {
    // El previo YA está visible en su cuenta; solo no le llegó el correo.
    return null;
  }
}
