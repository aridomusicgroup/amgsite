import { NextRequest, NextResponse } from "next/server";
import { createServerAuthClient } from "@/lib/supabase/auth-server";

/** Callback del magic link: intercambia el código por una sesión y entra al panel. */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createServerAuthClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/admin`);
}
