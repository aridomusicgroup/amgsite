import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/cuenta-auth";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const { origin } = new URL(req.url);
  const res = NextResponse.redirect(`${origin}/cuenta/login`);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
