import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/cuenta-auth";

/**
 * Compat: los enlaces antiguos apuntaban aquí. Ahora reenviamos a la página de
 * crear/restablecer contraseña conservando el token (si sigue vigente).
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get("token");
  const email = token ? verifyToken(token) : null;

  if (!email) {
    return NextResponse.redirect(`${origin}/cuenta/login?error=enlace`);
  }
  return NextResponse.redirect(`${origin}/cuenta/clave?token=${token}`);
}
