import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { proyectoDelPedido } from "@/lib/cuenta-cliente";
import { pushAEmails, destinoProyecto } from "@/lib/push";
import { adminEmails, crmEmails } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * El navegador ya subió el archivo DIRECTO a Drive (nuestro servidor nunca vio
 * los bytes) — esto solo avisa al staff de que algo nuevo llegó. Si falla, no
 * pasa nada grave: el archivo ya está en Drive de cualquier forma.
 */
export async function POST(req: NextRequest, { params }: Props) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const proy = await proyectoDelPedido(email, id);
  if (!proy) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const nombreArchivo = String(b.nombre || "un archivo").slice(0, 200);

  try {
    const sb = supabaseAdmin();
    const correos = [...new Set([...adminEmails(), ...crmEmails()])];
    await pushAEmails(sb, correos, {
      titulo: `📎 Archivo nuevo del cliente`,
      cuerpo: `${proy.folio ?? proy.titulo ?? "Proyecto"} · ${nombreArchivo}`,
      url: destinoProyecto(proy.proyectoId),
    });
  } catch {
    /* best-effort: el archivo ya está en Drive de todos modos */
  }

  return NextResponse.json({ ok: true });
}
