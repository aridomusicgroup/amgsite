import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { buscarOCrearCarpeta, tokenParaNavegador, diagnosticoDrive } from "@/lib/drive-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Le dice al script local DÓNDE subir un render y le presta un token para
 * hacerlo.
 *
 * Por qué así y no subiendo desde aquí: los archivos están en el disco de la
 * máquina con REAPER, y un WAV de entregables pesa ~85 MB — pasarlo por Vercel
 * sería lento y toparía con los límites de payload. El script sube directo a
 * Google con un token de una hora, y esta ruta se queda con la única parte que
 * sí debe vivir en el servidor: resolver la carpeta (misma estructura que usa
 * el resto del panel) sin repartir las credenciales de Google por ahí.
 *
 * Estructura que devuelve, espejo de la del disco:
 *   Clientes ARIDO / {cliente} / {folio} — {título} / [canción] / PREVIOS
 *                                                               / ENTREGABLES
 *                                                               / ENTREGABLES/{nombre} STEMS
 */
export async function POST(req: NextRequest) {
  // Secreto propio, no el CRON_SECRET: ese está guardado como "Secret" en
  // Vercel y no se puede volver a leer, así que compartirlo con la máquina
  // local obligaría a rotarlo y a arriesgar los crons que ya dependen de él.
  const secret = process.env.REAPER_SECRET;
  // A diferencia de las rutas de cron, aquí NO se permite pasar sin secreto:
  // esta entrega un token de escritura en Drive.
  if (!secret) return NextResponse.json({ error: "Falta REAPER_SECRET" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));

  // Token pelón, sin armar carpetas: lo pide el script cuando va a BAJAR un
  // archivo (la pista que subió un músico) en vez de subir uno. Un stem son
  // decenas de MB, así que baja directo de Google y no por aquí.
  if (b.soloToken) {
    const solo = await tokenParaNavegador();
    if (!solo) {
      return NextResponse.json({ error: (await diagnosticoDrive()) ?? "Drive no está conectado." }, { status: 503 });
    }
    return NextResponse.json({ accessToken: solo.accessToken, expiresAt: solo.expiresAt });
  }

  const proyectoId = String(b.proyectoId || "").trim();
  const tareaId = b.tareaId ? String(b.tareaId).trim() : null;
  const tipo = String(b.tipo || "").trim();
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const cred = await tokenParaNavegador();
  if (!cred) {
    return NextResponse.json({ error: (await diagnosticoDrive()) ?? "Drive no está conectado." }, { status: 503 });
  }

  const sb = supabaseAdmin();
  let carpeta = await carpetaDelProyecto(sb, proyectoId);
  if (!carpeta) return NextResponse.json({ error: "No se pudo resolver la carpeta del proyecto." }, { status: 409 });

  // Canción de EP/Álbum: cuelga de la del álbum, igual que en el disco.
  let nombreBase: string | null = null;
  if (tareaId) {
    const { data: t } = await sb.from("proyecto_tareas").select("titulo").eq("id", tareaId).single();
    if (!t) return NextResponse.json({ error: "La canción ya no existe." }, { status: 409 });
    nombreBase = String(t.titulo);
    carpeta = await buscarOCrearCarpeta(nombreBase, carpeta);
    if (!carpeta) return NextResponse.json({ error: "No se pudo crear la carpeta de la canción." }, { status: 502 });
  } else {
    const { data: p } = await sb.from("proyectos").select("titulo").eq("id", proyectoId).single();
    nombreBase = p ? String(p.titulo) : "Producción";
  }

  // Los previos de músico van aparte: son los únicos que se comparten con un
  // enlace público, y tenerlos en su propia carpeta hace obvio qué está expuesto.
  const destino =
    tipo === "musico"
      ? await buscarOCrearCarpeta("MUSICOS", carpeta)
      : tipo === "previo"
        ? await buscarOCrearCarpeta("PREVIOS", carpeta)
        : await entregables(carpeta, tipo, nombreBase);
  if (!destino) return NextResponse.json({ error: "No se pudo crear la carpeta de destino." }, { status: 502 });

  return NextResponse.json({
    folderId: destino,
    accessToken: cred.accessToken,
    expiresAt: cred.expiresAt,
  });
}

/** ENTREGABLES, y para stems una subcarpeta propia — igual que en el disco. */
async function entregables(carpeta: string, tipo: string, nombreBase: string | null): Promise<string | null> {
  const ent = await buscarOCrearCarpeta("ENTREGABLES", carpeta);
  if (!ent || tipo !== "stems") return ent;
  return buscarOCrearCarpeta(`${(nombreBase || "PROYECTO").toUpperCase()} STEMS`, ent);
}
