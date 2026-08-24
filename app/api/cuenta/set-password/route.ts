import { NextRequest, NextResponse } from "next/server";
import { verifyToken, hashPassword, makeSession, SESSION_COOKIE } from "@/lib/cuenta-auth";
import { setCredencial } from "@/lib/cuenta-cliente";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_LEN = 8;

/** Crea / restablece la contraseña con el token del enlace por correo, e inicia sesión. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`csetpw:${clientIp(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const token = String(b.token ?? "");
  const password = String(b.password ?? "");
  if (password.length < MIN_LEN) {
    return NextResponse.json({ error: `La contraseña debe tener al menos ${MIN_LEN} caracteres.` }, { status: 400 });
  }

  const email = verifyToken(token);
  if (!email) {
    return NextResponse.json({ error: "El enlace expiró o no es válido. Pide uno nuevo." }, { status: 401 });
  }

  await setCredencial(email, hashPassword(password));

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSession(email), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
