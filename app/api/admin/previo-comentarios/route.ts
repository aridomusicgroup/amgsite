import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { comentariosDeTarea } from "@/lib/previo-comentarios-server";

export const dynamic = "force-dynamic";

/**
 * Los comentarios del cliente que dieron origen a una tarea. La ventana de la
 * tarea los pide para mostrar el pedido ORIGINAL (las notas se pueden editar).
 */
export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const tareaId = new URL(req.url).searchParams.get("tarea_id")?.trim() ?? "";
  if (!tareaId) return NextResponse.json({ error: "Falta la tarea." }, { status: 400 });

  return NextResponse.json({ comentarios: await comentariosDeTarea(supabaseAdmin(), tareaId) });
}
