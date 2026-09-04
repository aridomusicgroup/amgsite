import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { GRUPOS } from "@/lib/modules";

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
  // Solo claves de área conocidas: así una versión vieja del navegador no puede
  // sembrar basura que después nadie sepa de dónde salió.
  if (Array.isArray(b.nav_colapsado)) {
    patch.nav_colapsado = [...new Set(b.nav_colapsado.filter((x: unknown) => (GRUPOS as readonly string[]).includes(x as string)))];
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("user_prefs").upsert(patch, { onConflict: "email" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
