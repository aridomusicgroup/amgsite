import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { correoDelPedidoDeContacto } from "@/lib/cliente-correo";

export const dynamic = "force-dynamic";

/**
 * ¿El correo de este contacto coincide con el de su(s) pedido(s) con
 * producción? Se llama bajo demanda al abrir la ficha en Clientes — nunca en
 * la lista completa. Ver lib/cliente-correo.ts para el porqué del diseño.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const correoContacto = req.nextUrl.searchParams.get("email");

  const sb = supabaseAdmin();
  const resultado = await correoDelPedidoDeContacto(sb, id, correoContacto);
  return NextResponse.json(resultado);
}
