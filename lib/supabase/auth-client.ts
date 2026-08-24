"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase para el navegador — solo se usa para el login (magic link). */
export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
