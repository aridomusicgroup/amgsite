import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { proyectoDelPedido } from "@/lib/cuenta-cliente";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tokenParaNavegador } from "@/lib/drive-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

const TIPOS: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav" };

/**
 * Sirve un archivo de render al cliente SIN exponerlo en Drive.
 *
 * El archivo vive en el Drive del estudio y no se comparte con nadie: este
 * proxy lo baja con el token del servidor y lo entrega sólo si quien lo pide
 * tiene sesión y el pedido es suyo. Así no hay enlaces públicos circulando.
 *
 * Se reenvía el header `Range` tal cual, que es lo que permite al reproductor
 * saltar a la mitad de la canción sin bajarla completa — y lo que hace viable
 * un WAV de decenas de MB.
 */
export async function GET(req: NextRequest, { params }: Props) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const proy = await proyectoDelPedido(email, id);
  if (!proy) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  const jobId = req.nextUrl.searchParams.get("job") ?? "";
  const idx = Number(req.nextUrl.searchParams.get("i") ?? "0");
  if (!jobId || !Number.isInteger(idx) || idx < 0) {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: job } = await sb
    .from("render_jobs")
    .select("proyecto_id, compartir, estado, drive_urls")
    .eq("id", jobId)
    .single();

  // Tiene que ser de ESTE pedido y estar compartido: sin esto, cualquier
  // cliente con sesión podría pedir el render de otro cambiando el id.
  if (!job || job.proyecto_id !== proy.proyectoId || !job.compartir || job.estado !== "listo") {
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }

  const archivo = ((job.drive_urls as { archivo: string; id: string }[] | null) ?? [])[idx];
  if (!archivo?.id) return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });

  const cred = await tokenParaNavegador();
  if (!cred) return NextResponse.json({ error: "Almacenamiento no disponible." }, { status: 503 });

  const rango = req.headers.get("range");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${archivo.id}?alt=media`, {
    headers: {
      authorization: `Bearer ${cred.accessToken}`,
      ...(rango ? { range: rango } : {}),
    },
  });
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "No se pudo leer el archivo." }, { status: 502 });
  }

  const ext = archivo.archivo.split(".").pop()?.toLowerCase() ?? "";
  const cabeceras = new Headers({
    "content-type": TIPOS[ext] ?? "application/octet-stream",
    "accept-ranges": "bytes",
    // Privado: es material del cliente, no debe quedarse en caches de terceros.
    "cache-control": "private, max-age=0, no-store",
    // ?d=1 = el botón de descargar; sin él se reproduce en la página.
    "content-disposition": `${req.nextUrl.searchParams.get("d") ? "attachment" : "inline"}; filename="${encodeURIComponent(archivo.archivo)}"`,
  });
  for (const h of ["content-length", "content-range"]) {
    const v = res.headers.get(h);
    if (v) cabeceras.set(h, v);
  }

  return new NextResponse(res.body, { status: res.status, headers: cabeceras });
}
