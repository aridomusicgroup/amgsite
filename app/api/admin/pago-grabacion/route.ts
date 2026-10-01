import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { preguntaDePago } from "@/lib/pago-grabacion";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_INSTRUMENTO = 60;

/**
 * La pregunta "¿le pagas al músico?" para un instrumento de un proyecto (o tema).
 *
 * La usa el push que les llega a los admins cuando otra persona —o el portal
 * del músico— palomea una grabación: el enlace trae proyecto, tema e
 * instrumento, y aquí se recalcula con lo que hay HOY. Si entretanto alguien ya
 * le pagó, contesta `null` y la ventana no se abre.
 */
export async function GET(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const u = new URL(req.url).searchParams;
  const proyectoId = String(u.get("proyecto_id") || "").trim();
  const temaId = String(u.get("tema_id") || "").trim() || null;
  const instrumento = String(u.get("instrumento") || "").trim().slice(0, MAX_INSTRUMENTO);
  if (!UUID.test(proyectoId) || (temaId && !UUID.test(temaId)) || !instrumento) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const pregunta = await preguntaDePago(supabaseAdmin(), { proyectoId, temaId, instrumento });
  return NextResponse.json({ pregunta });
}
