import { NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

// La sesión de staff vive en la cookie de admin.aridomusicgroup.com (el
// subdominio del panel) — el redirect_uri tiene que ser ese mismo dominio,
// no `DOMAINS.main`, o Google regresa aquí sin la cookie de sesión.
const REDIRECT_URI = "https://admin.aridomusicgroup.com/api/admin/drive-oauth/callback";

/**
 * Arranca la autorización de Drive (una sola vez): manda al admin a la
 * pantalla de consentimiento de Google para que dé "Permitir" con la cuenta
 * que va a recibir los archivos. `access_type=offline` + `prompt=consent`
 * fuerza a que Google entregue un refresh_token (si no, solo la primera vez
 * que se conecta esa app se entrega, y aquí conviene poder repetirlo).
 */
export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "Falta GOOGLE_OAUTH_CLIENT_ID en Vercel." }, { status: 503 });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/drive.file");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return NextResponse.redirect(url.toString());
}
