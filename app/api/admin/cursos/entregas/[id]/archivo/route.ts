import { NextRequest, NextResponse } from "next/server";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { descargarArchivoApp } from "@/lib/drive-oauth";
import { respuestaDeDrive } from "@/lib/curso-proxy";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** El video/audio de una entrega para revisarlo en el panel (con rango, para adelantar). */
export async function GET(req: NextRequest, { params }: Props) {
  if (!(await moduloPermitido("/admin/cursos"))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const { data } = await supabaseAdmin().from("curso_entregas").select("drive_file_id").eq("id", id).maybeSingle();
  if (!data?.drive_file_id) return NextResponse.json({ error: "Entrega no encontrada." }, { status: 404 });
  return respuestaDeDrive(await descargarArchivoApp(data.drive_file_id as string, req.headers.get("range")));
}
