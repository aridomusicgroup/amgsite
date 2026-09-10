import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { diagnosticoDrive } from "@/lib/drive-oauth";
import { alarmaDrive } from "@/lib/drive-alarma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Revisa una vez al día que Drive siga conectado.
 *
 * `alarmaDrive` ya avisa en el momento, pero sólo cuando el script del estudio
 * pide un token — o sea, sólo si esa computadora está prendida. De noche, en
 * fin de semana o en vacaciones nadie pregunta, así que el token podría estar
 * muerto tres días y nos enteraríamos el lunes, cuando el primer render se
 * quede en el disco.
 *
 * Esto lo pregunta desde el servidor, exista o no la máquina del estudio.
 * Corre temprano a propósito: reconectar toma un minuto, y hacerlo antes de
 * empezar el día vale más que descubrirlo a media producción.
 *
 * Silencioso cuando todo está bien. La alarma se encarga de no repetirse.
 */
export async function POST(req: NextRequest) {
  return revisar(req);
}
export async function GET(req: NextRequest) {
  return revisar(req);
}

async function revisar(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const motivo = await diagnosticoDrive();
  if (!motivo) return NextResponse.json({ ok: true, drive: "conectado" });

  await alarmaDrive(supabaseAdmin(), motivo);
  return NextResponse.json({ ok: true, drive: "caído", motivo });
}
