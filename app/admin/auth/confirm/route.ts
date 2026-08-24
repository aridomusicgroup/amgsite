import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Verificación del magic link por token_hash (server-side).
 * Funciona en cualquier navegador/dispositivo (no depende del verifier PKCE).
 * Las cookies de sesión se escriben directamente en la respuesta de redirección.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const token_hash = searchParams.get("token_hash");
  const type = (searchParams.get("type") as EmailOtpType | null) ?? "email";
  // Destino tras verificar (solo rutas locales /admin, por seguridad).
  const nextParam = searchParams.get("next");
  const dest = nextParam && nextParam.startsWith("/admin") ? nextParam : "/admin";

  const redirectTo = (path: string) => NextResponse.redirect(`${origin}${path}`);

  if (!token_hash) return redirectTo("/admin/login?error=enlace");

  // La respuesta donde se persistirá la sesión
  const response = redirectTo(dest);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) return redirectTo("/admin/login?error=enlace");

  return response;
}
