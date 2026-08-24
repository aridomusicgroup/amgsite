import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

// Debe ser IDÉNTICO al de start/route.ts y al registrado en Google Cloud —
// la sesión de staff vive en la cookie de admin.aridomusicgroup.com.
const REDIRECT_URI = "https://admin.aridomusicgroup.com/api/admin/drive-oauth/callback";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Google redirige aquí con el `code` después de que el admin da "Permitir".
 * Lo cambia por un refresh_token UNA vez y lo muestra en pantalla para que se
 * pegue a mano en Vercel (`GOOGLE_DRIVE_REFRESH_TOKEN`) — nunca se guarda solo
 * en ningún lado, mismo criterio que el resto de los secretos del proyecto.
 */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const code = req.nextUrl.searchParams.get("code");
  const errorParam = req.nextUrl.searchParams.get("error");
  if (errorParam) return NextResponse.json({ error: `Google dijo: ${errorParam}` }, { status: 400 });
  if (!code) return NextResponse.json({ error: "Falta el code." }, { status: 400 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Falta GOOGLE_OAUTH_CLIENT_ID/SECRET en Vercel." }, { status: 503 });
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const j = await res.json().catch(() => null);

  if (!j?.refresh_token) {
    return NextResponse.json(
      {
        error: "Google no regresó un refresh_token.",
        detalle: j?.error_description || j?.error || "Prueba de nuevo — a veces hay que revocar el acceso previo en https://myaccount.google.com/permissions y repetir.",
      },
      { status: 400 },
    );
  }

  const html = `<!doctype html><html><body style="font-family:sans-serif;max-width:640px;margin:40px auto;line-height:1.6">
<h2>✅ Conectado con Google Drive</h2>
<p>Copia este valor y pégalo en Vercel como la variable de entorno <code>GOOGLE_DRIVE_REFRESH_TOKEN</code> (Production). Después haz un redeploy.</p>
<textarea readonly style="width:100%;height:80px;font-family:monospace;padding:8px">${escapeHtml(j.refresh_token)}</textarea>
<p style="color:#a00">Esta pantalla no vuelve a mostrar este valor — cópialo ahora.</p>
</body></html>`;

  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
