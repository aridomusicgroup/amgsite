import { NextResponse } from "next/server";
import { getMusicoId } from "@/lib/musico-auth";
import { getMusico, asignacionDeMusico } from "@/lib/musico-data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { buscarOCrearCarpeta, tokenParaNavegador, diagnosticoDrive } from "@/lib/drive-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Presta un token corto de Drive para que el músico suba su archivo directo a
 * Google, y le dice a qué carpeta.
 *
 * Destino: la carpeta MUSICOS del proyecto — la misma que ya arma
 * `/api/reaper/drive` para los previos de músico. No se inventa una nueva.
 *
 * Nota de confianza, para que quede escrito: el token que se entrega es el de
 * la app (alcance `drive.file`, ~1 hora). Solo puede tocar archivos que la app
 * creó, nunca el Drive personal del estudio, pero durante esa hora quien lo
 * tenga puede direccionar cualquier archivo creado por la app si adivina su id.
 * Es exactamente el mismo trato que ya se le da a un cliente en
 * `/api/cuenta/pedido/[id]/drive-token`; se documenta aquí porque un proveedor
 * externo no es lo mismo que un cliente.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const musicoId = await getMusicoId();
  if (!musicoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Que siga teniendo portal, no solo que traiga cookie.
  const musico = await getMusico(musicoId);
  if (!musico) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await ctx.params;
  const asig = await asignacionDeMusico(musicoId, id);
  if (!asig) return NextResponse.json({ error: "Esa asignación no es tuya." }, { status: 404 });

  const cred = await tokenParaNavegador();
  if (!cred) {
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

  // El prefijo lo pone el servidor: en Drive se tiene que leer de quién es y de
  // qué instrumento aunque el músico haya subido un "audio final FINAL 2.wav".
  const limpio = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim();
  const prefijo = `${limpio(asig.instrumento).toUpperCase()} - ${limpio(musico.nombre)} - `;

  return NextResponse.json({
    folderId: destino,
    accessToken: cred.accessToken,
    expiresAt: cred.expiresAt,
    prefijo,
  });
}
