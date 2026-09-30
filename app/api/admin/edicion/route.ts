import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail, getFullAdminEmail, adminEmails } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buscarOCrearCarpeta, tokenParaNavegador, diagnosticoDrive } from "@/lib/drive-oauth";
import { pushAEmails, destinoProyectoTab, conProyecto } from "@/lib/push";
import { registrarActividad } from "@/lib/actividad";
import { carpetaEdicionDe } from "@/lib/edicion-carpetas";
import {
  esAlbum, estadoDeClave, temasDelAlbum, esTemaDe, aQuienAvisar, palomearEdicion, type Quien,
} from "@/lib/edicion-temas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * El envío del proyecto a quien edita, desde el panel.
 *
 * GET   — cómo va: el envío vivo, cuánto falta, y las revisiones que han vuelto.
 *         En un EP/álbum, lo mismo POR TEMA.
 * POST  — crear un envío ("Enviar lo que falta"), de un tema o de varios. Sólo admin.
 * PUT   — registrar una revisión que alguien acaba de subir a Drive.
 * PATCH — reintentar los archivos que agotaron sus intentos.
 *
 * Lo que NO está aquí a propósito: subir. Los archivos viven en el disco del
 * estudio y los sube el script local directo a Google — 1.3 GB no pasan por
 * Vercel.
 */

const MAX_NOMBRE = 200;
const MAX_TEMAS = 40;

/** La llave de este proyecto/canción, la misma que usa `render_inventario`. */
const claveDe = (proyectoId: string, tareaId: string | null) => tareaId || proyectoId;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/** Lee `tarea_id` del cuerpo o la URL y comprueba que sea canción de ESE proyecto. */
async function temaValido(sb: SB, proyectoId: string, crudo: unknown): Promise<{ tareaId: string | null } | { error: string }> {
  const tareaId = crudo ? String(crudo).trim() : null;
  if (!tareaId) return { tareaId: null };
  return (await esTemaDe(sb, proyectoId, tareaId)) ? { tareaId } : { error: "Esa canción no es de este proyecto." };
}

export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url).searchParams;
  const proyectoId = String(u.get("proyecto_id") || "").trim();
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: proy } = await sb.from("proyectos").select("tipo").eq("id", proyectoId).maybeSingle();

  // Un EP/álbum no tiene manifiesto propio: cada tema es su propia carpeta en
  // el disco y su propia clave. Antes la pantalla preguntaba por el proyecto,
  // no encontraba nada y el bloque desaparecía entero.
  if (esAlbum(proy?.tipo)) {
    const temas = await temasDelAlbum(sb, proyectoId);
    const estados = await Promise.all(temas.map((t) => estadoDeClave(sb, t.tareaId)));
    if (estados.some((e) => e === null)) return NextResponse.json({ sinTabla: true, album: true, temas: [] });
    return NextResponse.json({
      sinTabla: false,
      album: true,
      temas: temas.map((t, i) => ({ ...t, ...estados[i] })),
    });
  }

  const e = await estadoDeClave(sb, proyectoId);
  // La migración la corre una persona a mano: sin tablas, la pantalla dice que
  // no hay nada configurado en vez de romperse.
  if (!e) return NextResponse.json({ sinTabla: true, envios: [], revisiones: [] });
  return NextResponse.json({ sinTabla: false, album: false, ...e });
}

/**
 * "Enviar lo que falta".
 *
 * Sólo admin: el envío mueve gigas del disco del estudio, y que sólo lo dispare
 * quien está frente a esa máquina evita sorpresas.
 *
 * El botón siempre dice lo mismo y hace lo mismo; la primera vez, falta todo.
 * No hay un botón de "enviar" y otro de "reenviar" — ahí empieza el desastre.
 *
 * En un álbum se manda UN tema (`tarea_id`) o varios (`tarea_ids`, el botón de
 * "los temas listos"). Varios = un envío por tema, cada uno con su número, su
 * barra y su aviso: así el primero se puede editar mientras sube el segundo.
 */
export async function POST(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "Sólo un administrador puede mandar a editar." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyecto_id || "").trim();
  const nota = String(b.nota ?? "").trim().slice(0, 500) || null;
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const sb = supabaseAdmin();

  // Qué temas: uno, varios, o ninguno (beat personalizado).
  const pedidos: (string | null)[] = Array.isArray(b.tarea_ids)
    ? [...new Set((b.tarea_ids as unknown[]).map((x) => String(x).trim()).filter(Boolean))].slice(0, MAX_TEMAS)
    : [b.tarea_id ? String(b.tarea_id).trim() : null];
  if (!pedidos.length) return NextResponse.json({ error: "No elegiste ningún tema." }, { status: 400 });
  for (const t of pedidos) {
    if (t && !(await esTemaDe(sb, proyectoId, t))) {
      return NextResponse.json({ error: "Esa canción no es de este proyecto." }, { status: 400 });
    }
  }

  // Sólo lo que de verdad tiene algo que subir y no está ya subiendo.
  const candidatos: { tareaId: string | null; pendientes: number; quien: Quien }[] = [];
  for (const tareaId of pedidos) {
    const clave = claveDe(proyectoId, tareaId);
    const [{ count: pendientes }, { data: vivo }] = await Promise.all([
      sb.from("edicion_archivos").select("id", { count: "exact", head: true }).eq("clave", clave).is("subido_at", null),
      sb.from("edicion_envios").select("id").eq("clave", clave).in("estado", ["abierto", "subiendo"]).limit(1),
    ]);
    if (!pendientes || vivo?.length) continue;
    candidatos.push({ tareaId, pendientes, quien: await aQuienAvisar(sb, { proyectoId, tareaId, elegido: b.notificar_a }) });
  }
  if (!candidatos.length) {
    return NextResponse.json({
      error: pedidos.length > 1 ? "Ninguno de esos temas tiene algo nuevo que enviar." : "No hay nada nuevo que enviar.",
    }, { status: 409 });
  }

  // Enviar gigas y que nadie se entere es peor que no enviar: `lib/push.ts` se
  // traga el aviso EN SILENCIO si el correo es null. Se avisa antes, y quien
  // insista puede mandar igual con `forzar`.
  const sinCorreo = candidatos.find((c) => !c.quien.email);
  if (sinCorreo && !b.forzar) {
    return NextResponse.json({
      error: sinCorreo.quien.nombre
        ? `${sinCorreo.quien.nombre} no tiene correo en el equipo — no le va a llegar aviso.`
        : "No hay a quién avisarle: nadie tiene la tarea de editar y cuantizar.",
      sinCorreo: true,
    }, { status: 409 });
  }

  // Uno por uno y en el orden en que llegaron (el del disco): `creado_at` es lo
  // que el script usa para decidir qué tema sube primero.
  const hechos: { tarea_id: string | null; envio: number; archivos: number }[] = [];
  for (const c of candidatos) {
    const r = await crearEnvio(sb, { proyectoId, tareaId: c.tareaId, nota, actor, quien: c.quien });
    if ("error" in r) {
      // El primero que falla corta: lo ya creado se queda (es válido y va a subir).
      if (!hechos.length) return NextResponse.json({ error: r.error }, { status: r.status });
      break;
    }
    hechos.push({ tarea_id: c.tareaId, envio: r.num, archivos: c.pendientes });
  }

  const primero = hechos[0];
  return NextResponse.json({
    ok: true,
    envio: primero.envio,
    archivos: hechos.reduce((a, h) => a + h.archivos, 0),
    temas: hechos.length,
    avisaraA: candidatos[0].quien.email,
  });
}

async function crearEnvio(
  sb: SB,
  d: { proyectoId: string; tareaId: string | null; nota: string | null; actor: string; quien: Quien },
): Promise<{ num: number } | { error: string; status: number }> {
  const clave = claveDe(d.proyectoId, d.tareaId);
  const { data: ult } = await sb.from("edicion_envios")
    .select("num").eq("clave", clave).order("num", { ascending: false }).limit(1);
  const num = (Number(ult?.[0]?.num) || 0) + 1;

  const { data: env, error } = await sb.from("edicion_envios").insert({
    clave, proyecto_id: d.proyectoId, tarea_id: d.tareaId, num,
    estado: "abierto", nota: d.nota, pedido_por: d.actor,
    notificar_a: d.quien.id, notificar_email: d.quien.email,
  }).select("id, num").single();

  if (error) {
    // 23505 = el índice único parcial de "un solo envío vivo por clave". Es el
    // candado del doble clic, y aquí se traduce a algo que se entiende.
    if (error.code === "23505") return { error: "Ya hay un envío en curso para esto.", status: 409 };
    return { error: error.message, status: 500 };
  }
  return { num: env.num as number };
}

/**
 * Registra una revisión que alguien acabó de subir a Drive.
 *
 * El archivo ya está en Google (el navegador lo subió directo, es ~1 MB); esto
 * sólo lo anota y avisa. Es el mismo patrón de `subida-confirmada` del portal de
 * músicos: sin esta llamada el archivo existe en Drive y para nadie más.
 *
 * `terminado: true` = quien edita dijo que con esta revisión ese tema queda
 * editado, y se palomea "Editar y cuantizar".
 */
export async function PUT(req: NextRequest) {
  const actor = await getProduccionEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyecto_id || "").trim();
  const nombre = String(b.nombre || "").trim().slice(0, MAX_NOMBRE);
  const driveId = String(b.drive_id || "").trim();
  const nota = String(b.nota ?? "").trim().slice(0, 500) || null;
  const bytes = Number(b.bytes);

  if (!proyectoId || !nombre || !driveId) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  // Se revalida en el servidor: la del navegador es una comodidad. Sólo el .rpp
  // vuelve por aquí — el audio pesado no hace este viaje.
  if (!/\.rpp$/i.test(nombre)) return NextResponse.json({ error: "La revisión tiene que ser un .rpp." }, { status: 400 });

  const sb = supabaseAdmin();
  const tv = await temaValido(sb, proyectoId, b.tarea_id);
  if ("error" in tv) return NextResponse.json({ error: tv.error }, { status: 400 });
  const { tareaId } = tv;
  const clave = claveDe(proyectoId, tareaId);

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

  const [{ data: proy }, { data: tema }] = await Promise.all([
    sb.from("proyectos").select("titulo, responsables, responsable_id").eq("id", proyectoId).maybeSingle(),
    tareaId
      ? sb.from("proyecto_tareas").select("titulo").eq("id", tareaId).maybeSingle()
      : Promise.resolve({ data: null as { titulo: string } | null }),
  ]);
  const nombreTema = (tema?.titulo as string | null | undefined) ?? null;

  // Después de insertar la revisión, nunca antes: si el registro fallara, la
  // tarea quedaría palomeada sin revisión que la respalde.
  const palomeado = b.terminado === true ? await palomearEdicion(sb, { proyectoId, tareaId, actor }) : null;

  await registrarActividad(sb, {
    tipo: "edicion_revision",
    titulo: `Llegó la revisión ${num} ${nombreTema ? `de ${nombreTema}` : "del proyecto"}${palomeado ? " — edición terminada" : ""}`,
    actor,
    proyecto_id: proyectoId,
    tarea_id: tareaId,
    meta: { revision: num, nombre, nota, terminado: Boolean(palomeado) },
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

  const texto = `${nombreTema ? `${nombreTema}: ` : ""}llegó la revisión ${num}${palomeado ? " (edición terminada)" : ""}${nota ? ` — ${nota}` : ""}`;
  await pushAEmails(sb, [...(eq ?? []).map((r) => r.email), ...adminEmails()], {
    titulo: "ARIDO · Edición",
    cuerpo: conProyecto((proy?.titulo as string | null) ?? null, texto),
    url: destinoProyectoTab(proyectoId, "produccion"),
  });

  return NextResponse.json({ ok: true, revision: num, palomeado });
}

/** Devuelve a la cola los archivos que agotaron sus intentos. Lo decide una
 *  persona, nunca un cron: si algo falló cinco veces, repetirlo solo para
 *  siempre no lo arregla. */
export async function PATCH(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyecto_id || "").trim();
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const sb = supabaseAdmin();
  const tv = await temaValido(sb, proyectoId, b.tarea_id);
  if ("error" in tv) return NextResponse.json({ error: tv.error }, { status: 400 });

  const { error } = await sb.from("edicion_archivos")
    .update({ intentos: 0, reintentar_despues: null, ultimo_error: null })
    .eq("clave", claveDe(proyectoId, tv.tareaId))
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
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const sb = supabaseAdmin();
  const tv = await temaValido(sb, proyectoId, u.get("tarea_id"));
  if ("error" in tv) return NextResponse.json({ error: tv.error }, { status: 400 });

  const cred = await tokenParaNavegador();
  if (!cred) return NextResponse.json({ error: (await diagnosticoDrive()) ?? "Drive no está conectado." }, { status: 503 });

  // REVISIONES cuelga de la raíz de edición de ESA clave (en un álbum,
  // EDICION/{tema}/REVISIONES), y el escaneo del manifiesto la excluye a
  // propósito: si no, el siguiente "enviar lo que falta" le subiría de vuelta su
  // propia revisión, para siempre.
  const raiz = await carpetaEdicionDe(sb, { proyectoId, tareaId: tv.tareaId });
  if ("error" in raiz) return NextResponse.json({ error: raiz.error }, { status: raiz.status });
  const destino = await buscarOCrearCarpeta("REVISIONES", raiz.id);
  if (!destino) return NextResponse.json({ error: "No se pudo crear la carpeta de revisiones." }, { status: 502 });

  return NextResponse.json({ folderId: destino, accessToken: cred.accessToken, expiresAt: cred.expiresAt });
}
