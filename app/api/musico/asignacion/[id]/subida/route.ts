import { NextRequest, NextResponse } from "next/server";
import { getMusicoId } from "@/lib/musico-auth";
import { getMusico, asignacionDeMusico } from "@/lib/musico-data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { buscarOCrearCarpeta, diagnosticoDrive, driveOAuthConfigured, iniciarSubidaResumible } from "@/lib/drive-oauth";
import { origenDeSubida } from "@/lib/subida-servidor";
import { nombreDeSubida, mimeDeSubida, bytesDeSubida, etiquetaDeCanal } from "@/lib/subida-validar";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Mismo criterio que `subida-confirmada`: el previo se oye en el panel (mp3), la pista se mezcla (wav). */
const FORMATO: Record<string, RegExp> = { previo: /\.mp3$/i, stem: /\.wav$/i };

/**
 * Abre la subida de UN archivo del músico a la carpeta MUSICOS de su proyecto
 * (la misma que arma `/api/reaper/drive` para los previos de músico).
 *
 * Antes esta ruta se llamaba `drive-token` y le prestaba al músico el token de
 * la app (`drive.file`, ~1 h), que abre todo lo que la app ha creado — de
 * todos los clientes. Un proveedor externo con eso es peor que un cliente.
 * Ahora la sesión resumible se abre aquí y al navegador sólo le llega su URL.
 *
 * El nombre también lo pone el servidor: en Drive se tiene que leer de quién
 * es y de qué instrumento aunque el músico haya subido un "audio final FINAL 2.wav".
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const musicoId = await getMusicoId();
  if (!musicoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Que siga teniendo portal, no solo que traiga cookie.
  const musico = await getMusico(musicoId);
  if (!musico) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!rateLimit(`musesion:${musicoId}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas subidas seguidas. Espera unos minutos." }, { status: 429 });
  }

  const { id } = await ctx.params;
  const asig = await asignacionDeMusico(musicoId, id);
  if (!asig) return NextResponse.json({ error: "Esa asignación no es tuya." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const clase = String(b.clase || "");
  const nombre = nombreDeSubida(b.nombre);
  const bytes = bytesDeSubida(b.bytes);
  if (!(clase in FORMATO)) return NextResponse.json({ error: "Tipo de archivo desconocido." }, { status: 400 });
  if (!nombre || !FORMATO[clase].test(nombre)) {
    return NextResponse.json({ error: clase === "previo" ? "El previo tiene que ser un MP3." : "La pista tiene que ser un WAV." }, { status: 400 });
  }
  if (bytes == null) return NextResponse.json({ error: "Ese archivo está vacío o pesa demasiado." }, { status: 400 });

  if (!driveOAuthConfigured()) {
    return NextResponse.json({ error: (await diagnosticoDrive()) ?? "Drive no está conectado." }, { status: 503 });
  }

  const sb = supabaseAdmin();
  let carpeta = await carpetaDelProyecto(sb, asig.proyectoId);
  if (!carpeta) return NextResponse.json({ error: "No se pudo resolver la carpeta del proyecto." }, { status: 409 });

  // Canción de EP/álbum: cuelga de la del álbum, igual que en el disco.
  if (asig.tareaId) {
    const { data: t } = await sb.from("proyecto_tareas").select("titulo, es_cancion").eq("id", asig.tareaId).maybeSingle();
    if (t?.es_cancion) {
      const sub = await buscarOCrearCarpeta(String(t.titulo), carpeta);
      if (sub) carpeta = sub;
    }
  }

  const destino = await buscarOCrearCarpeta("MUSICOS", carpeta);
  if (!destino) return NextResponse.json({ error: "No se pudo crear la carpeta de destino." }, { status: 502 });

  const limpio = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();
  const prefijo = `${limpio(asig.instrumento).toUpperCase()} - ${limpio(musico.nombre)} - `;
  // El canal ("L", "Pista 2") entra en el nombre para que en Drive se distingan
  // las dos charchetas sin abrirlas — y para que la segunda no pise a la primera.
  const canal = clase === "stem" ? etiquetaDeCanal(b.canal) : "";
  const nombreDrive = `${prefijo}${canal ? `${canal} - ` : ""}${nombre}`;

  const mime = mimeDeSubida(b.mime, nombre);
  const uploadUrl = await iniciarSubidaResumible({ nombre: nombreDrive, mime, bytes, parentId: destino, origin: origenDeSubida(req) });
  if (!uploadUrl) return NextResponse.json({ error: "Google no aceptó la subida. Intenta en un momento." }, { status: 502 });
  return NextResponse.json({ uploadUrl, mime });
}
