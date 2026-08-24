import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Guarda las preferencias del PROPIO usuario (tamaño de letra, tema, orden de módulos).
export async function POST(req: NextRequest) {
  const email = await getAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { email: email.toLowerCase(), updated_at: new Date().toISOString() };
  if (["sm", "md", "lg"].includes(b.font_size)) patch.font_size = b.font_size;
  if (["dark", "light"].includes(b.theme)) patch.theme = b.theme;
  if (Array.isArray(b.module_order)) patch.module_order = b.module_order.filter((x: unknown) => typeof x === "string");

  const sb = supabaseAdmin();
  const { error } = await sb.from("user_prefs").upsert(patch, { onConflict: "email" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
