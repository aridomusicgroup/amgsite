import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { proyectoDelPedido } from "@/lib/cuenta-cliente";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { driveOAuthConfigured } from "@/lib/drive-oauth";
import { espacioDelProyecto } from "@/lib/subida-servidor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Lo que ya subió el cliente a la carpeta de su pedido y cuánto espacio le
 * queda. Antes se llamaba `drive-token` y además le daba al navegador un token
 * de Drive; ya no: cada subida pide su propia sesión en `../subida`.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!driveOAuthConfigured()) return NextResponse.json({ error: "Subida de archivos no disponible todavía." }, { status: 503 });

  const { id } = await params;
  const proy = await proyectoDelPedido(email, id);
  if (!proy) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  const sb = supabaseAdmin();
  const esp = await espacioDelProyecto(sb, proy);
  if (!esp) return NextResponse.json({ error: "No se pudo preparar la carpeta." }, { status: 503 });

  // Las voces viven en la misma carpeta pero ya salen en su propia caja ("Tus
  // voces"): aquí cuentan para el espacio, pero no se listan dos veces.
  // Tolerante: sin la tabla (SQL sin correr) se listan todas, como antes.
  const deVoces = new Set<string>();
  try {
    const { data, error } = await sb.from("voces_cliente").select("drive_id").eq("proyecto_id", proy.proyectoId);
    if (!error) for (const v of data ?? []) deVoces.add(v.drive_id as string);
  } catch {
    /* sin filtro */
  }

  return NextResponse.json({
    archivos: esp.archivos
      .filter((a) => !deVoces.has(a.id))
      .map((a) => ({ id: a.id, nombre: a.name, tamano: a.size ? Number(a.size) : null, url: a.webViewLink ?? null })),
    limiteBytes: esp.limiteBytes,
    usadoBytes: esp.usadoBytes,
  });
}
