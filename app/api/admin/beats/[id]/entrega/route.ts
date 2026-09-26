import { NextRequest, NextResponse } from "next/server";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { beatParaPanel } from "@/lib/catalog";
import { carpetaDe } from "@/lib/beat-admin";
import { revisarCarpeta } from "@/lib/beat-carpetas";
import { driveConfigured, cuentaServicioEmail } from "@/lib/drive-api";
import { evaluar } from "@/lib/beats-auditoria";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

/**
 * "¿Se puede entregar ESTE beat?" — la auditoría del catálogo, para uno solo.
 * Cuenta los archivos que Drive reporta AHORA (no lo guardado). Sólo lee.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const email = await moduloPermitido("/admin/beats");
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!rateLimit(`beat-entrega:${email}`, 20, 60_000)) {
    return NextResponse.json({ error: "Demasiadas revisiones seguidas. Espera un momento." }, { status: 429 });
  }
  if (!driveConfigured()) {
    return NextResponse.json({ error: "Falta configurar la cuenta de servicio de Google (sólo existe en Vercel)." }, { status: 503 });
  }

  const { id } = await params;
  const p = await beatParaPanel(id);
  if (!p) return NextResponse.json({ error: "Ese beat no existe." }, { status: 404 });

  const carpeta = await carpetaDe(id, p.source, p.fila);
  if (!carpeta) {
    return NextResponse.json({
      ok: true,
      revision: evaluar({ id, title: p.beat.title, origen: p.source, tieneCarpeta: false }, {}, 0),
    });
  }

  const rev = await revisarCarpeta(carpeta.folderId);
  if (!rev) return NextResponse.json({ error: "No se pudo consultar Google Drive." }, { status: 503 });

  return NextResponse.json({
    ok: true,
    cuentaServicio: cuentaServicioEmail(),
    revision: evaluar(
      { id, title: p.beat.title, origen: p.source, tieneCarpeta: true, carpetaId: carpeta.folderId, manual: carpeta.manual },
      rev.archivos,
      rev.sueltos,
    ),
  });
}
