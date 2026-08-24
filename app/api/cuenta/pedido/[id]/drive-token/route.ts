import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { proyectoDelPedido } from "@/lib/cuenta-cliente";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaDelProyecto } from "@/lib/proyecto-carpeta";
import { tokenParaNavegador, archivosDeCarpeta, driveOAuthConfigured } from "@/lib/drive-oauth";
import { limiteEfectivoMb } from "@/lib/almacenamiento";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Le da al NAVEGADOR del cliente lo que necesita para subir directo a Drive:
 * un token de acceso de corta duración + el ID de la carpeta de su proyecto
 * (creada si es la primera vez), más lo que ya se subió antes.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!driveOAuthConfigured()) return NextResponse.json({ error: "Subida de archivos no disponible todavía." }, { status: 503 });

  const { id } = await params;
  const proy = await proyectoDelPedido(email, id);
  if (!proy) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  const sb = supabaseAdmin();
  const folderId = await carpetaDelProyecto(sb, proy.proyectoId);
  if (!folderId) return NextResponse.json({ error: "No se pudo preparar la carpeta." }, { status: 503 });

  const token = await tokenParaNavegador();
  if (!token) return NextResponse.json({ error: "No se pudo generar el token." }, { status: 503 });

  const archivos = await archivosDeCarpeta(folderId);
  const usadoBytes = archivos.reduce((a, f) => a + (f.size ? Number(f.size) : 0), 0);

  let defaults: Record<string, number> = {};
  try {
    const { data } = await sb.from("almacenamiento_tipos_default").select("tipo, limite_mb");
    for (const r of data ?? []) defaults[r.tipo as string] = Number(r.limite_mb) || 0;
  } catch {
    defaults = {};
  }
  const limiteMb = limiteEfectivoMb(proy.tipo, proy.limiteAlmacenamientoMb, defaults);

  return NextResponse.json({
    accessToken: token.accessToken,
    expiresAt: token.expiresAt,
    folderId,
    archivos: archivos.map((a) => ({ id: a.id, nombre: a.name, tamano: a.size ? Number(a.size) : null, url: a.webViewLink ?? null })),
    limiteBytes: limiteMb * 1024 * 1024,
    usadoBytes,
  });
}
