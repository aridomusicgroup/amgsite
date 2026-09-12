import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { hijosDeCarpetas } from "@/lib/drive-api";
import {
  carpetaDe,
  carpetaUrl,
  itemsOrdenados,
  leerTokenDescarga,
  licenciaPorMonto,
  mapaDeCarpetas,
} from "@/lib/beat-descarga";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ token: string }> };

const EXT: Record<string, RegExp> = { MP3: /\.mp3$/i, WAV: /\.wav$/i };

const noDisponible = () =>
  new NextResponse("Este enlace de descarga no es válido. Escríbenos y te lo reenviamos.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

/**
 * Botón MP3/WAV de un beat comprado → descarga directa (ver lib/beat-descarga).
 *
 * Busca el archivo en la subcarpeta del formato y redirige a la descarga de
 * Google. Si algo falla al buscarlo (cuenta de servicio, carpeta sin archivo)
 * cae a la carpeta de ese formato, que es lo que el botón abría antes: el
 * cliente nunca se queda sin su beat.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { token } = await params;
  const t = leerTokenDescarga(token);
  if (!t) return noDisponible();

  const sb = supabaseAdmin();
  const { data: order } = await sb
    .from("orders")
    .select("type, status, order_items(description, amount)")
    .eq("id", t.orderId)
    .maybeSingle();
  if (!order || order.type !== "beat" || order.status === "cancelado") return noDisponible();

  const items = itemsOrdenados(
    ((order.order_items as { description: string; amount: number }[] | null) ?? []).map((i) => ({
      description: String(i.description),
      amount: Number(i.amount),
    })),
  );
  const item = items[t.idx];
  if (!item) return noDisponible();

  // El token sólo se emite para los formatos de la licencia comprada. Aun así,
  // si por el monto se reconoce una licencia que NO lo incluye, no se entrega.
  const { files, exclusive } = licenciaPorMonto(item.amount);
  if (!exclusive && files && !files.includes(t.formato)) return noDisponible();

  const carpeta = carpetaDe(await mapaDeCarpetas(sb), item.description);
  const sub = carpeta?.subfolders?.[t.formato];
  if (!sub) return carpeta ? NextResponse.redirect(carpetaUrl(carpeta.driveFolderId)) : noDisponible();

  const hijos = (await hijosDeCarpetas([sub]).catch(() => null)) ?? [];
  const archivos = hijos.filter((h) => !h.esCarpeta);
  const archivo = archivos.find((h) => EXT[t.formato].test(h.name)) ?? archivos[0];
  if (!archivo || !/^[\w-]{10,}$/.test(archivo.id)) return NextResponse.redirect(carpetaUrl(sub));

  const destino = new URL("https://drive.usercontent.google.com/download");
  destino.searchParams.set("id", archivo.id);
  destino.searchParams.set("export", "download");
  // Sin esto, un archivo de más de 100 MB muestra el aviso de "no se pudo
  // analizar en busca de virus" en vez de bajarse.
  destino.searchParams.set("confirm", "t");
  return NextResponse.redirect(destino.toString(), { headers: { "cache-control": "no-store" } });
}
