import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { archivosDeCarpetaPaginado, tokenParaNavegador, driveOAuthConfigured } from "@/lib/drive-oauth";

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

  const sb = supabaseAdmin();
  const folderId = await carpetaDelProyecto(sb, id);
  if (!folderId) return NextResponse.json({ error: "No se pudo resolver la carpeta de Drive.", files: [], nextPageToken: null, folderId: null });

  const [{ files, nextPageToken }, token] = await Promise.all([
    archivosDeCarpetaPaginado(folderId, pageToken),
    tokenParaNavegador(),
  ]);

  return NextResponse.json({
    files, nextPageToken, folderId,
    upload: token ? { accessToken: token.accessToken, expiresAt: token.expiresAt } : null,
  });
}
