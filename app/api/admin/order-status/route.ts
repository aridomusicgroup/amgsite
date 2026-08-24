import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORDER_STATUSES } from "@/lib/admin-data";
import { ORDER_TO_PROY } from "@/lib/estado-sync";

/** Cambia el estado de un pedido (pipeline). Solo admins autenticados. */
export async function POST(req: NextRequest) {
  const email = await getAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { orderId, status } = await req.json().catch(() => ({}));
  if (!orderId || !ORDER_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("orders").update({ status }).eq("id", orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mantiene en sync el proyecto de Producción ligado a este pedido.
  if (ORDER_TO_PROY[status]) {
    try {
      await sb.from("proyectos").update({ estado: ORDER_TO_PROY[status], updated_at: new Date().toISOString() }).eq("order_id", orderId);
    } catch { /* sin proyecto ligado o tabla ausente: ignorar */ }
  }

  return NextResponse.json({ ok: true });
}
