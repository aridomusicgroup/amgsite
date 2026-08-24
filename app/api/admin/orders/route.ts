import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { corregirCorreoDeOrder } from "@/lib/cliente-correo";

export const dynamic = "force-dynamic";

// ── Editar un pedido (solo admin total) ──
export async function PATCH(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del pedido." }, { status: 400 });

  const sb = supabaseAdmin();

  if (typeof b.customer_email === "string" && b.customer_email.trim()) {
    const r = await corregirCorreoDeOrder(sb, id, b.customer_email, actor);
    if (r) return NextResponse.json({ error: r.error }, { status: r.status });
  }

  const patch: Record<string, unknown> = {};
  if ("summary" in b) patch.summary = b.summary ? String(b.summary) : null;
  if ("note" in b) patch.note = b.note ? String(b.note) : null;
  if (b.total !== undefined && b.total !== "") patch.total = Number(b.total) || 0;
  if (["beat", "servicio"].includes(b.type)) patch.type = b.type;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true }); // solo se pidió corregir el correo

  const { error } = await sb.from("orders").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Eliminar un pedido (solo admin total) ──
// order_items se borra por cascade; los gastos ligados (expenses.order_id, sin
// cascade) se sueltan antes para no romper la FK.
export async function DELETE(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del pedido." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: ord } = await sb.from("orders").select("id").eq("id", id).single();
  if (!ord) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  await sb.from("expenses").update({ order_id: null }).eq("order_id", id);
  const { error } = await sb.from("orders").delete().eq("id", id); // order_items cascade
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
