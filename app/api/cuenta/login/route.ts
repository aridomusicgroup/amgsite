import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, makeSession, SESSION_COOKIE } from "@/lib/cuenta-auth";
import { getCredencial } from "@/lib/cuenta-cliente";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Login de cliente con correo + contraseña. */
export async function POST(req: NextRequest) {
  if (!rateLimit(`clogin:${clientIp(req)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos." }, { status: 429 });
  }

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !password) {
    return NextResponse.json({ error: "Correo o contraseña inválidos." }, { status: 400 });
  }

  const hash = await getCredencial(email);
  // Mensaje genérico para no revelar si el correo existe o no.
  if (!hash || !verifyPassword(password, hash)) {
    return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSession(email), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
