import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { datosRecompra, marcarRecompra } from "@/lib/recompra-envio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Decidir un ciclo de recompra: programarlo como seguimiento, o descartarlo.
 *
 * Igual que `/api/admin/crm-seguimiento`, entra también el rol `crm`: perseguir
 * la recompra es el trabajo diario, no una edición sensible del contacto.
 *
 * La decisión se sella en `interacciones.external_id` (único) para que el mismo
 * cliente no vuelva a aparecer en la bandeja. La marca lleva la fecha de su
 * última compra: si vuelve a comprar, el ciclo se re-arma solo.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "crm")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  const accion = String(b.accion || "");
  if (!id) return NextResponse.json({ error: "Falta el id del contacto." }, { status: 400 });
  if (accion !== "contactado" && accion !== "omitir") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // El ancla se recalcula en el servidor (no se confía en lo que mande el
  // navegador): es lo que hace idempotente la marca.
  const d = await datosRecompra(sb, id);
  if (!d) return NextResponse.json({ error: "Ese contacto no tiene compras." }, { status: 400 });

  const err = await marcarRecompra(sb, {
    id,
    ancla: d.ancla,
    accion,
    mensaje: typeof b.mensaje === "string" ? b.mensaje : null,
    autor: s.email,
  });
  if (err) return NextResponse.json({ error: err.error }, { status: 500 });

  return NextResponse.json({ ok: true });
}
