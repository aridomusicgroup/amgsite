import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { proyectoDelPedido } from "@/lib/cuenta-cliente";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { driveOAuthConfigured, iniciarSubidaResumible } from "@/lib/drive-oauth";
import { espacioDelProyecto, origenDeSubida } from "@/lib/subida-servidor";
import { nombreDeSubida, mimeDeSubida, bytesDeSubida, cabeEnEspacio } from "@/lib/subida-validar";
import { aceptaVoces, esWav } from "@/lib/voces-cliente";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

const formatoTamano = (b: number) => (b < 1024 ** 3 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${(b / 1024 ** 3).toFixed(1)} GB`);

/**
 * Abre la subida de UN archivo del cliente a la carpeta de Drive de su pedido.
 *
 * Antes el navegador recibía un token de Drive (`drive.file`, ~1 h) que abría
 * TODO lo que la app ha creado — entregables, voces y contratos de los demás
 * clientes. Ahora la sesión resumible se abre aquí, con la carpeta de ESTE
 * proyecto como destino, y al navegador sólo le llega su URL: sirve para subir
 * los bytes de ese archivo y nada más. Mismo patrón que las entregas de Cursos.
 *
 * Aquí se cobra el espacio del proyecto (antes sólo lo revisaba el navegador).
 * `clase: "voz"` es la caja "Tus voces": sólo WAV y sólo en pedidos que la llevan.
 * Los bytes siguen yendo directo del navegador a Google (sin el límite de Vercel).
 */
export async function POST(req: NextRequest, { params }: Props) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!driveOAuthConfigured()) return NextResponse.json({ error: "Subida de archivos no disponible todavía." }, { status: 503 });

  const { id } = await params;
  const proy = await proyectoDelPedido(email, id);
  if (!proy) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  if (!rateLimit(`subida:${email}`, 60, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas subidas seguidas. Espera unos minutos." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const nombre = nombreDeSubida(b.nombre);
  const bytes = bytesDeSubida(b.bytes);
  const esVoz = b.clase === "voz";
  if (!nombre) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  if (bytes == null) return NextResponse.json({ error: "Ese archivo está vacío o pesa demasiado." }, { status: 400 });
  if (esVoz) {
    if (!aceptaVoces(proy.tipo)) return NextResponse.json({ error: "Este pedido no recibe voces." }, { status: 400 });
    if (!esWav(nombre)) return NextResponse.json({ error: "Tu voz tiene que ser un archivo WAV." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const esp = await espacioDelProyecto(sb, proy);
  if (!esp) return NextResponse.json({ error: "No se pudo preparar la carpeta." }, { status: 503 });
  if (!cabeEnEspacio(esp.usadoBytes, esp.limiteBytes, bytes)) {
    return NextResponse.json(
      { error: `"${nombre}" no cabe — ya usaste ${formatoTamano(esp.usadoBytes)} de ${formatoTamano(esp.limiteBytes)}. Contáctanos si necesitas más espacio.` },
      { status: 413 },
    );
  }

  const mime = mimeDeSubida(b.mime, nombre);
  const uploadUrl = await iniciarSubidaResumible({ nombre, mime, bytes, parentId: esp.folderId, origin: origenDeSubida(req) });
  if (!uploadUrl) return NextResponse.json({ error: "Google no aceptó la subida. Intenta en un momento." }, { status: 502 });
  return NextResponse.json({ uploadUrl, mime });
}
