import { NextRequest, NextResponse } from "next/server";
import { verifyTokenMusico, makeSessionMusico, MUSICO_COOKIE, MUSICO_MAX_AGE } from "@/lib/musico-auth";
import { getMusico } from "@/lib/musico-data";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Entrada al portal por enlace de correo.
 *
 * A diferencia de `/cuenta/entrar` —que hoy solo reenvía a poner contraseña—
 * aquí el enlace SÍ abre la sesión: los músicos no tienen contraseña a
 * propósito. Entran dos veces al mes; una contraseña más es la razón número uno
 * de que no vuelvan a entrar.
 *
 * El token vale 30 minutos. Si ya venció, no se dice por qué con detalle: se
 * manda a una página que explica que pida otro enlace.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);

  // El token es la autorización entera, así que se limita el ritmo de intentos:
  // sin esto alguien podría probar firmas a placer contra esta ruta.
  if (!rateLimit(`musentrar:${clientIp(req)}`, 20, 10 * 60_000)) {
    return NextResponse.redirect(`${origin}/musico/enlace?e=limite`);
  }

  const token = searchParams.get("token") || "";
  const musicoId = token ? verifyTokenMusico(token) : null;
  if (!musicoId) return NextResponse.redirect(`${origin}/musico/enlace?e=vencido`);

  // Que el enlace esté firmado no basta: si le apagaron el portal desde que se
  // mandó, no entra.
  const musico = await getMusico(musicoId);
  if (!musico) return NextResponse.redirect(`${origin}/musico/enlace?e=sinacceso`);

  const res = NextResponse.redirect(`${origin}/musico`);
  res.cookies.set(MUSICO_COOKIE, makeSessionMusico(musicoId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MUSICO_MAX_AGE,
  });
  return res;
}
