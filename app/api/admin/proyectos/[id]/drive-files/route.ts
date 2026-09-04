import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { contenidoDeCarpeta, carpetaCuelgaDe, tokenParaNavegador, driveOAuthConfigured } from "@/lib/drive-oauth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// Lista los archivos de la carpeta de Drive del proyecto (creándola si aún no
// existe) y, de paso, entrega un token de subida de corta duración para que el
// navegador suba directo a Drive — sin pasar por el límite de payload de
// Vercel. Mismo mecanismo que ya usa el script local de reaper-sync
// (tokenParaNavegador), solo que aquí va al navegador del admin.
export async function GET(req: NextRequest, { params }: Props) {
  const email = await getProduccionEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!driveOAuthConfigured()) return NextResponse.json({ error: "Drive no está conectado.", files: [], nextPageToken: null, folderId: null }, { status: 200 });

  const { id } = await params;
  const pageToken = req.nextUrl.searchParams.get("pageToken") ?? undefined;
  const pedida = req.nextUrl.searchParams.get("carpeta");

  const sb = supabaseAdmin();
  const folderId = await carpetaDelProyecto(sb, id);
  if (!folderId) return NextResponse.json({ error: "No se pudo resolver la carpeta de Drive.", files: [], nextPageToken: null, folderId: null });

  // Se puede entrar a una subcarpeta (PREVIOS, ENTREGABLES, MUSICOS…), pero
  // SOLO si de verdad cuelga de la del proyecto. Sin esta comprobación, cambiar
  // el parámetro a mano listaría cualquier carpeta creada por la app —
  // incluida la de otro cliente.
  let verId = folderId;
  if (pedida && pedida !== folderId) {
    if (!(await carpetaCuelgaDe(pedida, folderId))) {
      return NextResponse.json({ error: "Esa carpeta no es de este proyecto." }, { status: 403 });
    }
    verId = pedida;
  }

  const [{ files, nextPageToken }, token] = await Promise.all([
    contenidoDeCarpeta(verId, pageToken),
    tokenParaNavegador(),
  ]);

  return NextResponse.json({
    files, nextPageToken,
    // `folderId` sigue siendo el del PROYECTO: es a donde sube el navegador,
    // pase lo que pase con la navegación.
    folderId,
    carpetaActual: verId,
    upload: token ? { accessToken: token.accessToken, expiresAt: token.expiresAt } : null,
  });
}
