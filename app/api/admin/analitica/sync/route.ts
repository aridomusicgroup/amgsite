import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { syncAnalitica } from "@/lib/analitica";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Autoriza: admin con sesión (disparo manual) O el cron de Vercel (Bearer CRON_SECRET).
async function authorized(req: NextRequest): Promise<boolean> {
  if (await getFullAdminEmail()) return true;
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const results = await syncAnalitica();
  const ok = results.length > 0 && results.every((r) => r.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 207 });
}

export const POST = GET;
