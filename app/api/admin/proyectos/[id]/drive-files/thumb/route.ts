import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { descargarThumbnail } from "@/lib/drive-oauth";

export const dynamic = "force-dynamic";

// Proxy de miniaturas de Drive: NUNCA reenvía una URL arbitraria (eso sería un
// open proxy / riesgo de SSRF) — solo acepta hosts de Google, y solo a
// usuarios con acceso al panel de Producción.
const HOST_PERMITIDO = /(^|\.)googleusercontent\.com$|(^|\.)google\.com$/;

export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return new NextResponse(null, { status: 401 });

  const url = req.nextUrl.searchParams.get("url") || "";
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!HOST_PERMITIDO.test(host)) return new NextResponse(null, { status: 400 });

  const img = await descargarThumbnail(url);
  if (!img) return new NextResponse(null, { status: 404 });
  return new NextResponse(img.data, {
    headers: { "content-type": img.contentType, "cache-control": "private, max-age=300" },
  });
}
