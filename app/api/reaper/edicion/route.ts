import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { buscarOCrearCarpeta, tokenParaNavegador, diagnosticoDrive } from "@/lib/drive-oauth";

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

  return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
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
