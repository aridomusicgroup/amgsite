import { NextRequest, NextResponse } from "next/server";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { renderizables, musicosParaPrevio } from "@/lib/render-jobs";

export const dynamic = "force-dynamic";

/**
 * Lo que necesita el cuadro de opciones del previo para abrirse desde la
 * pregunta "¿mandas previo al cliente?": la cosa renderizable (el proyecto, o
 * la canción de un EP) con su inventario de .rpp, y los músicos.
 *
 * Mismo candado que lanzar el render: sólo quien puede usar REAPER.
 */
export async function GET(req: NextRequest) {
  if (!(await moduloPermitido("/admin/dev-logs"))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const proyectoId = q.get("proyecto_id")?.trim() ?? "";
  const temaId = q.get("tema_id")?.trim() || null;
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const [lista, musicos] = await Promise.all([
    renderizables({ proyectoId }),
    musicosParaPrevio().catch(() => []),
  ]);
  const p = lista.find((x) => x.tareaId === temaId) ?? null;
  if (!p) return NextResponse.json({ error: "Este proyecto no tiene nada que renderizar todavía." }, { status: 404 });
  return NextResponse.json({ p, musicos });
}
