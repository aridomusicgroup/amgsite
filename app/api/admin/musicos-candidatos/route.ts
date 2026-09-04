import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { candidatosPorInstrumento } from "@/lib/musicos-sync";

export const dynamic = "force-dynamic";

/**
 * Quién puede tocar cada instrumento, para elegir al armar la venta.
 *
 * Hace falta porque el catálogo tiene dos tololoches y dos trombones: sin
 * preguntar, el sistema creaba pagos para los dos. Ver `crearPagosMusicoPendientes`.
 *
 * A propósito NO devuelve la tarifa: quien llena el formulario de la venta no
 * siempre es admin, y el monto lo pone el servidor desde el catálogo de todos
 * modos. Aquí solo hace falta el nombre para poder escoger.
 */
export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const crudo = new URL(req.url).searchParams.get("instrumentos") ?? "";
  const instrumentos = crudo.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 30);
  if (!instrumentos.length) return NextResponse.json({ candidatos: {} });

  const mapa = await candidatosPorInstrumento(supabaseAdmin(), instrumentos);
  const candidatos: Record<string, { id: string; nombre: string; portal: boolean }[]> = {};
  for (const [inst, lista] of Object.entries(mapa)) {
    candidatos[inst] = lista.map((m) => ({ id: m.id, nombre: m.nombre, portal: m.portal }));
  }
  return NextResponse.json({ candidatos });
}
