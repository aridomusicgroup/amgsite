import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { musicosDeVenta } from "@/lib/musicos-venta";

export const dynamic = "force-dynamic";

/** Quién se contrató para ESTE proyecto, y para qué instrumento (ver lib/musicos-venta). */
export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const proyectoId = new URL(req.url).searchParams.get("proyecto_id");
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  return NextResponse.json({ musicos: await musicosDeVenta(supabaseAdmin(), proyectoId) });
}
