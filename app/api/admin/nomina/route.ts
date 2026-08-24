import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Registra un pago de nómina (sueldo semanal de un miembro del equipo).
export async function POST(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { persona_id, periodo_inicio, monto, tipo, estado } = body;

  if (!persona_id || !periodo_inicio || !(Number(monto) > 0)) {
    return NextResponse.json({ error: "Faltan datos (persona, semana o monto)." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("nomina").insert({
    persona_id,
    periodo_inicio,
    monto: Number(monto),
    tipo: tipo || "sueldo",
    estado: estado || "pagado",
    fecha_pago: (estado || "pagado") === "pagado" ? periodo_inicio : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Borra un pago de nómina (por si se registró mal).
export async function DELETE(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const sb = supabaseAdmin();
  const { error } = await sb.from("nomina").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
