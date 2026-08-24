import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// ── Dar acceso manual a un curso ──
export async function POST(req: NextRequest) {
  const staffEmail = await getAdminEmail();
  if (!staffEmail) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const cursoId = String(b.curso_id || "").trim();
  const email = String(b.email || "").trim().toLowerCase();
  if (!cursoId || !email) return NextResponse.json({ error: "Faltan datos (curso o correo)." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("curso_accesos").upsert(
    { curso_id: cursoId, email, origen: "manual", otorgado_por: staffEmail },
    { onConflict: "curso_id,email", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── Revocar acceso ──
export async function DELETE(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del acceso." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("curso_accesos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
