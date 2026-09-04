import { NextResponse } from "next/server";
import { MUSICO_COOKIE } from "@/lib/musico-auth";

export const dynamic = "force-dynamic";

/** Cierra la sesión del portal de músicos. GET porque es un enlace, no un formulario. */
export async function GET(req: Request) {
  const res = NextResponse.redirect(`${new URL(req.url).origin}/musico/enlace`);
  res.cookies.set(MUSICO_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
