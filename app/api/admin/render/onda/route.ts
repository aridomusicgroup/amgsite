import { NextRequest, NextResponse } from "next/server";
import { moduloPermitido } from "@/lib/supabase/auth-server";
import { ondaDe } from "@/lib/render-onda";
import { consultaOndaValida } from "@/lib/onda-rango";

export const dynamic = "force-dynamic";

/**
 * La forma de onda de una versión del .rpp, para dibujarla en el cuadro de
 * opciones de render. Mismo permiso que encolar el render: es parte de ese cuadro.
 *
 * Una sola fila (~2 KB) y sólo al abrir el cuadro: por eso no viaja dentro del
 * inventario, que se relee cada 2 minutos. `onda: null` = todavía no se calcula
 * (el script lo hace en su siguiente corrida) o la tabla no existe.
 */
export async function GET(req: NextRequest) {
  if (!(await moduloPermitido("/admin/dev-logs"))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const clave = String(q.get("clave") || "");
  const archivo = String(q.get("archivo") || "");
  if (!consultaOndaValida(clave, archivo)) return NextResponse.json({ error: "Consulta no válida." }, { status: 400 });

  return NextResponse.json({ onda: await ondaDe(clave, archivo) });
}
