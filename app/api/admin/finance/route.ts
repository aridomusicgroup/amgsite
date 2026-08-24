import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Alta/baja de egresos e ingresos manuales. Solo admins. */
export async function POST(req: NextRequest) {
  const email = await getFullAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, kind } = body;
  const sb = supabaseAdmin();
  const table = kind === "income" ? "manual_income" : "expenses";

  if (action === "create") {
    const amount = Number(body.amount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
    }
    const description = (body.description || "").slice(0, 300) || null;
    const currency = body.currency || "MXN";

    if (kind === "income") {
      const { data, error } = await sb
        .from("manual_income")
        .insert({
          amount,
          currency,
          source: (body.source || "Otro").slice(0, 80),
          description,
          ...(body.date ? { date: body.date } : {}),
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, row: data });
    }

    const { data, error } = await sb
      .from("expenses")
      .insert({
        amount,
        currency,
        category: (body.category || "Otro").slice(0, 80),
        description,
        order_id: body.order_id || null,
        ...(body.date ? { date: body.date } : {}),
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, row: data });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    const { error } = await sb.from(table).delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
