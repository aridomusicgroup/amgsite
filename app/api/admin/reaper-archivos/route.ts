import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { renderizables } from "@/lib/render-jobs";
import { opcionesRpp } from "@/lib/abrir-reaper";

export const dynamic = "force-dynamic";

/**
 * Los .rpp de un proyecto, para el botón "Abrir en REAPER" del tablero de
 * Producción. Se piden al hacer clic y no junto con el tablero: el inventario
 * trae pistas y marcadores de cada .rpp, y bajarlo en cada carga (y en cada
 * refresco en vivo) sería egress tirado para un botón que casi no se usa.
 */
export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("proyecto") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });
  try {
    return NextResponse.json({ opciones: opcionesRpp(await renderizables({ proyectoId: id })) });
  } catch (e) {
    console.error("reaper-archivos", e);
    return NextResponse.json({ error: "No se pudo leer el inventario de REAPER." }, { status: 500 });
  }
}
