import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OPCIONALES } from "@/lib/modules";

export const dynamic = "force-dynamic";

// SOLO admins: define qué módulos opcionales tiene habilitados otro usuario.
export async function POST(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const target = String(b.email || "").trim().toLowerCase();
  if (!target || !Array.isArray(b.modules_extra)) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }
  // Solo se permiten módulos opcionales (nunca dinero/admin-only).
  const allowed = b.modules_extra.filter((m: unknown) => typeof m === "string" && OPCIONALES.includes(m));

  const sb = supabaseAdmin();
  const { error } = await sb.from("user_prefs").upsert(
    { email: target, modules_extra: allowed, updated_at: new Date().toISOString() },
    { onConflict: "email" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
