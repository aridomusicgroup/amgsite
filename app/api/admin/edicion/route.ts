import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail, getFullAdminEmail, adminEmails } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { buscarOCrearCarpeta, tokenParaNavegador, diagnosticoDrive } from "@/lib/drive-oauth";
import { pushAEmails, destinoProyectoTab, conProyecto } from "@/lib/push";
import { registrarActividad } from "@/lib/actividad";
import { resolverEquipo } from "@/lib/produccion-tareas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * El envío del proyecto a quien edita, desde el panel.
 *
 * GET   — cómo va: el envío vivo, cuánto falta, y las revisiones que han vuelto.
 * POST  — crear un envío ("Enviar lo que falta"). Sólo admin.
 * PUT   — registrar una revisión que alguien acaba de subir a Drive.
 * PATCH — reintentar los archivos que agotaron sus intentos.
 *
 * Lo que NO está aquí a propósito: subir. Los archivos viven en el disco del
 * estudio y los sube el script local directo a Google — 1.3 GB no pasan por
 * Vercel.
 */

const MAX_NOMBRE = 200;

/** La llave de este proyecto/canción, la misma que usa `render_inventario`. */
const claveDe = (proyectoId: string, tareaId: string | null) => tareaId || proyectoId;

export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url).searchParams;
  const proyectoId = String(u.get("proyecto_id") || "").trim();
  const tareaId = u.get("tarea_id");
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });
  const clave = claveDe(proyectoId, tareaId);

  const sb = supabaseAdmin();

  // Los conteos se DERIVAN, no se guardan: un contador guardado se desincroniza
  // el primer día que una subida falle a medias, y entonces la barra miente.
  const cuenta = (q: ReturnType<typeof sb.from>) => q;
  const [envios, total, subidos, fallados, revs] = await Promise.all([
    sb.from("edicion_envios").select("*").eq("clave", clave).order("num", { ascending: false }),
    cuenta(sb.from("edicion_archivos")).select("id", { count: "exact", head: true }).eq("clave", clave),
    cuenta(sb.from("edicion_archivos")).select("id", { count: "exact", head: true }).eq("clave", clave).not("subido_at", "is", null),
    cuenta(sb.from("edicion_archivos")).select("id", { count: "exact", head: true }).eq("clave", clave).is("subido_at", null).gte("intentos", 5),
    sb.from("edicion_revisiones").select("*").eq("clave", clave).order("num", { ascending: false }),
  ]);

  // La migración la corre una persona a mano: sin tablas, la pantalla dice que
  // no hay nada configurado en vez de romperse.
  if (envios.error) return NextResponse.json({ sinTabla: true, envios: [], revisiones: [] });

  // El peso sí necesita traer filas. Se pide sólo lo pendiente, que es lo que
  // se muestra ("faltan 12 archivos, 84 MB"), y eso casi siempre son pocas.
  const { data: pend } = await sb.from("edicion_archivos")
    .select("bytes").eq("clave", clave).is("subido_at", null).limit(1000);
  const bytesPendientes = (pend ?? []).reduce((a, r) => a + Number(r.bytes), 0);

  return NextResponse.json({
    sinTabla: false,
    envios: envios.data ?? [],
    revisiones: revs.data ?? [],
    total: total.count ?? 0,
    subidos: subidos.count ?? 0,
    fallados: fallados.count ?? 0,
    pendientes: (total.count ?? 0) - (subidos.count ?? 0),
    bytesPendientes,
    truncado: (pend ?? []).length >= 1000,
  });
}

/**
 * "Enviar lo que falta".
 *
 * Sólo admin: el envío mueve gigas del disco del estudio, y que sólo lo dispare
 * quien está frente a esa máquina evita sorpresas.
 *
 * El botón siempre dice lo mismo y hace lo mismo; la primera vez, falta todo.
 * No hay un botón de "enviar" y otro de "reenviar" — ahí empieza el desastre.
 */
export async function POST(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "Sólo un administrador puede mandar a editar." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyecto_id || "").trim();
  const tareaId = b.tarea_id ? String(b.tarea_id).trim() : null;
  const nota = String(b.nota ?? "").trim().slice(0, 500) || null;
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });
  const clave = claveDe(proyectoId, tareaId);

  const sb = supabaseAdmin();

  const { count: pendientes } = await sb.from("edicion_archivos")
    .select("id", { count: "exact", head: true }).eq("clave", clave).is("subido_at", null);
  if (!pendientes) {
    return NextResponse.json({ error: "No hay nada nuevo que enviar." }, { status: 409 });
  }

  const quien = await aQuienAvisar(sb, proyectoId, b.notificar_a);
  // Enviar gigas y que nadie se entere es peor que no enviar: `lib/push.ts` se
  // traga el aviso EN SILENCIO si el correo es null. Se avisa antes, y quien
  // insista puede mandar igual con `forzar`.
  if (!quien.email && !b.forzar) {
    return NextResponse.json({
      error: quien.nombre
        ? `${quien.nombre} no tiene correo en el equipo — no le va a llegar aviso.`
        : "No hay a quién avisarle: nadie tiene la tarea de editar y cuantizar.",
      sinCorreo: true,
    }, { status: 409 });
  }

  const { data: ult } = await sb.from("edicion_envios")
    .select("num").eq("clave", clave).order("num", { ascending: false }).limit(1);
  const num = (Number(ult?.[0]?.num) || 0) + 1;

  const { data: env, error } = await sb.from("edicion_envios").insert({
    clave, proyecto_id: proyectoId, tarea_id: tareaId, num,
    estado: "abierto", nota, pedido_por: actor,
    notificar_a: quien.id, notificar_email: quien.email,
  }).select("id, num").single();

  if (error) {
    // 23505 = el índice único parcial de "un solo envío vivo por clave". Es el
    // candado del doble clic, y aquí se traduce a algo que se entiende.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya hay un envío en curso para este proyecto." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, envio: env.num, archivos: pendientes, avisaraA: quien.email });
}

/**
 * A quién avisar, resuelto AL ENVIAR y congelado en la fila.
 *
 * Si se dedujera al momento del aviso, reasignar la tarea entre el envío y el
 * final de la subida mandaría la notificación a otra persona.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function aQuienAvisar(sb: any, proyectoId: string, elegido: unknown) {
  const { data: eq } = await sb.from("equipo").select("id, nombre, email");
  const equipo = (eq ?? []) as { id: string; nombre: string; email: string | null }[];
  const porId = (id: string | null) => equipo.find((e) => e.id === id) ?? null;

  // 1. Lo que eligió una persona en el diálogo. Gana siempre.
  if (elegido) {
    const e = porId(String(elegido));
    if (e) return { id: e.id, email: e.email, nombre: e.nombre };
  }

  // 2. Quien tenga la tarea de editar y cuantizar en este proyecto.
  const { data: tareas } = await sb.from("proyecto_tareas")
    .select("responsable_id").eq("proyecto_id", proyectoId).ilike("titulo", "%cuantiz%").limit(5);
  for (const t of tareas ?? []) {
    const e = porId(t.responsable_id);
    if (e) return { id: e.id, email: e.email, nombre: e.nombre };
  }

  // 3. El alias de siempre — la misma función que puso a esa persona en las
  //    plantillas de tareas desde el principio.
  const id = resolverEquipo(equipo)("diego");
  const e = porId(id);
  return e ? { id: e.id, email: e.email, nombre: e.nombre } : { id: null, email: null, nombre: null };
}

/**
 * Registra una revisión que alguien acabó de subir a Drive.
 *
 * El archivo ya está en Google (el navegador lo subió directo, es ~1 MB); esto
 * sólo lo anota y avisa. Es el mismo patrón de `subida-confirmada` del portal de
 * músicos: sin esta llamada el archivo existe en Drive y para nadie más.
 */
export async function PUT(req: NextRequest) {
  const actor = await getProduccionEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyecto_id || "").trim();
  const tareaId = b.tarea_id ? String(b.tarea_id).trim() : null;
  const nombre = String(b.nombre || "").trim().slice(0, MAX_NOMBRE);
  const driveId = String(b.drive_id || "").trim();
  const nota = String(b.nota ?? "").trim().slice(0, 500) || null;
  const bytes = Number(b.bytes);

  if (!proyectoId || !nombre || !driveId) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  // Se revalida en el servidor: la del navegador es una comodidad. Sólo el .rpp
  // vuelve por aquí — el audio pesado no hace este viaje.
  if (!/\.rpp$/i.test(nombre)) return NextResponse.json({ error: "La revisión tiene que ser un .rpp." }, { status: 400 });

  const clave = claveDe(proyectoId, tareaId);
  const sb = supabaseAdmin();

  const { data: ult } = await sb.from("edicion_revisiones")
    .select("num").eq("clave", clave).order("num", { ascending: false }).limit(1);
  const num = (Number(ult?.[0]?.num) || 0) + 1;

  const { error } = await sb.from("edicion_revisiones").insert({
    clave, proyecto_id: proyectoId, tarea_id: tareaId, num,
    nombre, drive_id: driveId, nota,
    bytes: Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes) : null,
    subido_por: actor,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: proy } = await sb.from("proyectos")
    .select("titulo, responsables, responsable_id").eq("id", proyectoId).maybeSingle();

  await registrarActividad(sb, {
    tipo: "edicion_revision",
    titulo: `Llegó la revisión ${num} del proyecto`,
    actor,
    proyecto_id: proyectoId,
    tarea_id: tareaId,
    meta: { revision: num, nombre, nota },
  });

  // Responsables + admins, en UNA sola lista de correos. Con dos llamadas
  // separadas, un admin que además sea responsable recibe el aviso dos veces:
  // `pushAResponsables` y `pushAEmails` deduplican por dentro, no entre sí.
  const ids = [
    ...(((proy?.responsables as string[] | null) ?? []) as string[]),
    (proy?.responsable_id as string | null) ?? null,
  ].filter(Boolean);
  const { data: eq } = ids.length
    ? await sb.from("equipo").select("email").in("id", ids)
    : { data: [] as { email: string | null }[] };

  await pushAEmails(sb, [...(eq ?? []).map((r) => r.email), ...adminEmails()], {
    titulo: "ARIDO · Edición",
    cuerpo: conProyecto((proy?.titulo as string | null) ?? null, `Llegó la revisión ${num}${nota ? ` — ${nota}` : ""}`),
    url: destinoProyectoTab(proyectoId, "produccion"),
  });

  return NextResponse.json({ ok: true, revision: num });
}

/** Devuelve a la cola los archivos que agotaron sus intentos. Lo decide una
 *  persona, nunca un cron: si algo falló cinco veces, repetirlo solo para
 *  siempre no lo arregla. */
export async function PATCH(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyecto_id || "").trim();
  const tareaId = b.tarea_id ? String(b.tarea_id).trim() : null;
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("edicion_archivos")
    .update({ intentos: 0, reintentar_despues: null, ultimo_error: null })
    .eq("clave", claveDe(proyectoId, tareaId))
    .is("subido_at", null)
    .gte("intentos", 5);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Token y carpeta para que el navegador suba la revisión directo a Drive. */
export async function OPTIONS(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url).searchParams;
  const proyectoId = String(u.get("proyecto_id") || "").trim();
  const tareaId = u.get("tarea_id");
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const cred = await tokenParaNavegador();
  if (!cred) return NextResponse.json({ error: (await diagnosticoDrive()) ?? "Drive no está conectado." }, { status: 503 });

  const sb = supabaseAdmin();
  let base = await carpetaDelProyecto(sb, proyectoId);
  if (!base) return NextResponse.json({ error: "No se pudo resolver la carpeta del proyecto." }, { status: 409 });

  if (tareaId) {
    const { data: t } = await sb.from("proyecto_tareas").select("titulo, es_cancion").eq("id", tareaId).maybeSingle();
    if (t?.es_cancion) {
      const sub = await buscarOCrearCarpeta(String(t.titulo), base);
      if (sub) base = sub;
    }
  }

  // REVISIONES cuelga de EDICION, y el escaneo del manifiesto la excluye a
  // propósito: si no, el siguiente "enviar lo que falta" le subiría de vuelta su
  // propia revisión, para siempre.
  const edicion = await buscarOCrearCarpeta("EDICION", base);
  const destino = edicion ? await buscarOCrearCarpeta("REVISIONES", edicion) : null;
  if (!destino) return NextResponse.json({ error: "No se pudo crear la carpeta de revisiones." }, { status: 502 });

  return NextResponse.json({ folderId: destino, accessToken: cred.accessToken, expiresAt: cred.expiresAt });
}
