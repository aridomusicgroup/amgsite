import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Versión del deploy actual. Cambia en cada despliegue de Vercel, así el panel
 * puede detectar si hay una versión nueva y avisar al equipo para refrescar.
 */
export function GET() {
  const v =
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "dev";
  return NextResponse.json({ v }, { headers: { "Cache-Control": "no-store" } });
}
