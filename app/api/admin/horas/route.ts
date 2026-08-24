import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ── Registrar horas (servicio social / colaboradores) ──
export async function POST(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const equipoId = String(b.equipo_id || "").trim();
  const horas = Number(b.horas);
  if (!equipoId || !(horas > 0)) return NextResponse.json({ error: "Faltan datos (persona u horas)." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("equipo_horas").insert({
    equipo_id: equipoId,
    fecha: b.fecha || new Date().toISOString().slice(0, 10),
    horas,
    nota: b.nota || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Borrar un registro de horas ──
export async function DELETE(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("equipo_horas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
