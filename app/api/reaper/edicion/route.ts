import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { buscarOCrearCarpeta, tokenParaNavegador, diagnosticoDrive, compartirConCorreo } from "@/lib/drive-oauth";
import { pushAEmails, destinoProyectoTab, conProyecto } from "@/lib/push";
import { registrarActividad } from "@/lib/actividad";
import { Resend } from "resend";
import { edicionListaEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Le dice al script local dónde subir la carpeta del proyecto para quien edita.
 *
 * Mismo reparto de responsabilidades que `/api/reaper/drive`: las credenciales
 * de Google viven SÓLO aquí, el script recibe una carpeta y un token de una hora
 * y sube directo a Google. Una carpeta de proyecto son 1.3 GB — pasarla por
 * Vercel no es una opción.
 *
 * La estructura en Drive es espejo del árbol del disco:
 *   Clientes ARIDO / {cliente} / {folio} — {título} / [canción] / EDICION
 *                                                               / EDICION/Media
 *                                                               / EDICION/MUSICOS
 *
 * Los ids se cachean en `edicion_carpetas` porque si no serían ~880 llamadas de
 * "buscar o crear carpeta" por envío, una por archivo.
 */

/** Tope de profundidad. Las carpetas reales son Media/ y MUSICOS/; más allá de
 *  esto no es un proyecto de REAPER, es otra cosa. */
const MAX_TRAMOS = 6;

export async function POST(req: NextRequest) {
  const secret = process.env.REAPER_SECRET;
  // Igual que en /api/reaper/drive: aquí se entrega un token de ESCRITURA en
  // Drive, así que sin secreto no se pasa — a diferencia de las rutas de cron.
  if (!secret) return NextResponse.json({ error: "Falta REAPER_SECRET" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const accion = String(b.accion || "");

  if (accion === "carpeta") return resolverCarpeta(b);
  if (accion === "compartir") return compartir(b);
  if (accion === "aviso") return avisar(b);

  return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
}

/**
 * Le da acceso a la carpeta a quien va a editar, por su cuenta de Google.
 *
 * Se comparte SÓLO la raíz EDICION: Drive hereda el permiso a todo lo que
 * cuelgue después, así que los archivos que se suban más tarde ya nacen
 * accesibles y no hay que compartir 300 veces.
 *
 * Con `reader`, no `writer`: la revisión vuelve por el panel, no por Drive. Con
 * permiso de escritura podría borrar la sesión completa sin querer y no habría
 * marcha atrás automática.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function compartir(b: any) {
  const envioId = String(b.envioId || "").trim();
  if (!envioId) return NextResponse.json({ error: "Falta el envío." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: env } = await sb
    .from("edicion_envios")
    .select("id, clave, notificar_email, compartido_con")
    .eq("id", envioId)
    .maybeSingle();
  if (!env) return NextResponse.json({ error: "Ese envío ya no existe." }, { status: 404 });

  const correo = String(env.notificar_email || "").trim().toLowerCase();
  if (!correo) return NextResponse.json({ ok: true, omitido: "el envío no tiene correo a quien avisar" });
  if (env.compartido_con === correo) return NextResponse.json({ ok: true, yaEstaba: true });

  const { data: raiz } = await sb
    .from("edicion_carpetas")
    .select("drive_id")
    .eq("clave", env.clave)
    .eq("subruta", "")
    .maybeSingle();
  if (!raiz?.drive_id) return NextResponse.json({ ok: true, omitido: "la carpeta todavía no existe" });

  const ok = await compartirConCorreo(raiz.drive_id, correo, "reader");
  if (!ok) return NextResponse.json({ error: "Drive no aceptó compartir la carpeta." }, { status: 502 });

  await sb.from("edicion_envios").update({ compartido_con: correo }).eq("id", envioId);
  return NextResponse.json({ ok: true, compartido: correo, carpeta: `https://drive.google.com/drive/folders/${raiz.drive_id}` });
}

/**
 * Avisa a quien edita que ya está todo arriba.
 *
 * El momento importa: esto se llama al CERRAR el envío, nunca al abrirlo. Un
 * aviso que diga "empecé a subir 1.3 GB, vuelve en media hora" no le sirve a
 * nadie y enseña a ignorar las notificaciones.
 *
 * El texto se arma AQUÍ y no en el script, igual que `/api/reaper/aviso`: las
 * plantillas y el mecanismo de push viven en el sitio, el script sólo dice
 * "este envío terminó".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function avisar(b: any) {
  const envioId = String(b.envioId || "").trim();
  if (!envioId) return NextResponse.json({ error: "Falta el envío." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: env } = await sb
    .from("edicion_envios")
    .select("id, clave, proyecto_id, tarea_id, num, estado, nota, notificar_a, notificar_email, avisado_en")
    .eq("id", envioId)
    .maybeSingle();
  if (!env) return NextResponse.json({ error: "Ese envío ya no existe." }, { status: 404 });
  if (env.estado !== "listo") return NextResponse.json({ ok: true, omitido: "el envío no ha terminado" });
  if (env.avisado_en) return NextResponse.json({ ok: true, omitido: "ya se avisó antes" });

  const correo = String(env.notificar_email || "").trim().toLowerCase();
  if (!correo) return NextResponse.json({ ok: true, omitido: "sin correo a quien avisar" });

  // Se marca ANTES de mandar: si el script reintenta, vale más que falte un
  // aviso a que lleguen tres iguales.
  await sb.from("edicion_envios").update({ avisado_en: new Date().toISOString() }).eq("id", envioId);

  const [{ data: proy }, { count: n }, { data: pesos }] = await Promise.all([
    sb.from("proyectos").select("titulo").eq("id", env.proyecto_id).maybeSingle(),
    sb.from("edicion_archivos").select("id", { count: "exact", head: true }).eq("clave", env.clave).not("subido_at", "is", null),
    sb.from("edicion_archivos").select("bytes").eq("clave", env.clave).not("subido_at", "is", null).limit(1000),
  ]);

  // El peso exacto no vale una segunda consulta paginada: es para un texto de
  // notificación, no para una factura.
  const mb = (pesos ?? []).reduce((a, r) => a + Number(r.bytes), 0) / 1e6;
  const cuanto = mb > 900 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`;

  const cuerpo = env.num === 1
    ? `Ya está en Drive lo que tienes que editar — ${n} archivos, ${cuanto}`
    : `Se subieron los archivos que faltaban — envío ${env.num}`;

  const urlPanel = destinoProyectoTab(env.proyecto_id as string, "produccion");

  await pushAEmails(sb, [correo], {
    titulo: "ARIDO · Edición",
    cuerpo: conProyecto((proy?.titulo as string | null) ?? null, env.nota ? `${cuerpo}. ${env.nota}` : cuerpo),
    // A la pestaña, no al tablero: este aviso pide una acción que vive ahí.
    url: urlPanel,
  });

  // Y por correo, ADEMÁS del push.
  //
  // El push llega al momento pero se pierde si el teléfono está silenciado o si
  // no lo mira en la hora siguiente. Este aviso puede tardar media hora en salir
  // (lo que tarde la subida), no se repite, y de él depende que alguien empiece
  // a editar: si se pierde, el proyecto se queda parado sin que nadie lo sepa.
  // El correo se queda en la bandeja y sobrevive al fin de semana.
  const correoEnviado = await mandarCorreo(sb, {
    correo,
    clave: env.clave as string,
    proyecto: (proy?.titulo as string | null) ?? "la producción",
    envio: env.num as number,
    archivos: n ?? 0,
    peso: cuanto,
    nota: (env.nota as string | null) ?? null,
    notificarA: (env.notificar_a as string | null) ?? null,
    urlPanel,
  });

  await registrarActividad(sb, {
    tipo: "edicion_enviada",
    titulo: `Se le mandó a editar el envío ${env.num} (${n} archivos)`,
    actor: null,
    proyecto_id: env.proyecto_id as string,
    tarea_id: (env.tarea_id as string | null) ?? null,
    meta: { envio: env.num, archivos: n, correo, correoEnviado },
  });

  return NextResponse.json({ ok: true, avisado: correo, correo: correoEnviado });
}

/**
 * Arma y manda el correo de "ya puedes editar".
 *
 * Best-effort a propósito y aparte del push: que Resend falle no puede tumbar el
 * aviso ni dejar el envío sin marcar. Si no sale, queda el push y la bitácora.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mandarCorreo(sb: any, d: {
  correo: string; clave: string; proyecto: string; envio: number;
  archivos: number; peso: string; nota: string | null;
  notificarA: string | null; urlPanel: string;
}): Promise<boolean> {
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) return false;

    // El enlace directo a la carpeta, que es lo que de verdad va a usar. Si
    // todavía no existe se manda igual: el botón del panel siempre sirve.
    const { data: raiz } = await sb.from("edicion_carpetas")
      .select("drive_id").eq("clave", d.clave).eq("subruta", "").maybeSingle();

    // El nombre para saludarlo. Sale de `equipo`, que es a quien apunta la tarea.
    let nombre: string | null = null;
    if (d.notificarA) {
      const { data: e } = await sb.from("equipo").select("nombre").eq("id", d.notificarA).maybeSingle();
      nombre = (e?.nombre as string | null) ?? null;
    }

    const mail = edicionListaEmail({
      nombre,
      proyecto: d.proyecto,
      envio: d.envio,
      archivos: d.archivos,
      peso: d.peso,
      nota: d.nota,
      urlDrive: raiz?.drive_id ? `https://drive.google.com/drive/folders/${raiz.drive_id}` : null,
      urlPanel: d.urlPanel,
    });

    await new Resend(key).emails.send({
      from: "Latino Gang Beats <acceso@aridomusicgroup.com>",
      to: d.correo,
      subject: mail.subject,
      html: mail.html,
    });
    return true;
  } catch {
    // El push ya salió y el envío ya está marcado; el correo es el refuerzo.
    return false;
  }
}

/**
 * Resuelve (creando si falta) `EDICION/<subruta>` y devuelve su id + un token.
 *
 * `subruta` es la parte de directorios de la ruta relativa del archivo:
 * "Media/29-C414.wav" → subruta "Media". Vacía = la carpeta EDICION misma.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolverCarpeta(b: any) {
  const clave = String(b.clave || "").trim();
  const proyectoId = String(b.proyectoId || "").trim();
  const tareaId = b.tareaId ? String(b.tareaId).trim() : null;
  const subruta = String(b.subruta ?? "").trim();

  if (!clave || !proyectoId) return NextResponse.json({ error: "Falta la clave o el proyecto." }, { status: 400 });

  // Los tramos vienen de `path.relative` del lado del script, pero esto es una
  // ruta de red: un ".." aquí se traduciría en trepar el árbol de Drive.
  const tramos = subruta ? subruta.split("/").map((t: string) => t.trim()).filter(Boolean) : [];
  if (tramos.length > MAX_TRAMOS) return NextResponse.json({ error: "Subruta demasiado profunda." }, { status: 400 });
  if (tramos.some((t: string) => t === "." || t === "..")) {
    return NextResponse.json({ error: "Subruta inválida." }, { status: 400 });
  }

  const cred = await tokenParaNavegador();
  if (!cred) {
    return NextResponse.json({ error: (await diagnosticoDrive()) ?? "Drive no está conectado." }, { status: 503 });
  }

  const sb = supabaseAdmin();

  // ¿Ya la resolvimos antes? Es lo que evita las 880 llamadas.
  const { data: cache } = await sb
    .from("edicion_carpetas")
    .select("drive_id")
    .eq("clave", clave)
    .eq("subruta", subruta)
    .maybeSingle();
  if (cache?.drive_id) {
    return NextResponse.json({ folderId: cache.drive_id, accessToken: cred.accessToken, expiresAt: cred.expiresAt });
  }

  // La raíz EDICION se resuelve siempre: es el padre de todo lo demás, y así
  // queda cacheada la primera vez que se pide cualquier subcarpeta.
  let base = await carpetaDelProyecto(sb, proyectoId);
  if (!base) return NextResponse.json({ error: "No se pudo resolver la carpeta del proyecto." }, { status: 409 });

  // Canción de EP/Álbum: cuelga de la del álbum, igual que en el disco.
  if (tareaId) {
    const { data: t } = await sb.from("proyecto_tareas").select("titulo").eq("id", tareaId).maybeSingle();
    if (!t) return NextResponse.json({ error: "La canción ya no existe." }, { status: 409 });
    base = await buscarOCrearCarpeta(String(t.titulo), base);
    if (!base) return NextResponse.json({ error: "No se pudo crear la carpeta de la canción." }, { status: 502 });
  }

  let actual = await buscarOCrearCarpeta("EDICION", base);
  if (!actual) return NextResponse.json({ error: "No se pudo crear la carpeta EDICION." }, { status: 502 });
  await guardar(sb, clave, "", actual);

  // Y luego cada tramo, guardando el camino: pedir "Media/X/Y" deja cacheadas
  // también "Media" y "Media/X", que es lo que van a pedir los demás archivos.
  const recorridas: string[] = [];
  for (const t of tramos) {
    recorridas.push(t);
    const hija = await buscarOCrearCarpeta(t, actual);
    if (!hija) return NextResponse.json({ error: `No se pudo crear la carpeta ${t}.` }, { status: 502 });
    actual = hija;
    await guardar(sb, clave, recorridas.join("/"), hija);
  }

  return NextResponse.json({ folderId: actual, accessToken: cred.accessToken, expiresAt: cred.expiresAt });
}

/** Cachea el id. `ignoreDuplicates` porque dos corridas solapadas pueden
 *  resolver la misma carpeta a la vez, y eso no es un error. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function guardar(sb: any, clave: string, subruta: string, driveId: string) {
  try {
    await sb.from("edicion_carpetas").upsert(
      { clave, subruta, drive_id: driveId },
      { onConflict: "clave,subruta", ignoreDuplicates: true },
    );
  } catch {
    /* el id ya lo tenemos en memoria; cachearlo es una optimización */
  }
}
