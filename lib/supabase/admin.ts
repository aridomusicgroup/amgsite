import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con service_role (acceso total, salta RLS).
 * SOLO se usa en el servidor, nunca se expone al navegador.
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase admin no configurado (faltan env vars).");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
