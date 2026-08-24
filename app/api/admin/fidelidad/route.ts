import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nivelDeContacto, creditoDisponible } from "@/lib/fidelidad-server";

export const dynamic = "force-dynamic";

/**
 * El nivel de fidelidad de un contacto, para previsualizar el descuento al
 * armar una cotización "de contado". Solo lectura — el % que de verdad se
 * cobra se vuelve a calcular en el servidor al guardar (nunca se confía en lo
 * que esta ruta le mostró al navegador).
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "crm")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const contactoId = new URL(req.url).searchParams.get("contacto_id");
  if (!contactoId) return NextResponse.json({ error: "Falta el contacto." }, { status: 400 });

  const sb = supabaseAdmin();
  try {
    const [nivel, credito] = await Promise.all([
      nivelDeContacto(sb, contactoId),
      creditoDisponible(sb, contactoId),
    ]);
    return NextResponse.json({ ...nivel, creditoDisponible: credito });
  } catch {
    return NextResponse.json({ nivel: 0, descuentoPct: 0, faltanParaSubir: null, creditoDisponible: 0 });
  }
}
