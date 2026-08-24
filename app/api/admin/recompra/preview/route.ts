import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { datosRecompra, correoRecompra } from "@/lib/recompra-envio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Vista previa del correo de recompra: devuelve el MISMO HTML que se mandaría.
 *
 * Existe para que nadie mande a ciegas. El panel lo pinta en un iframe, así que
 * lo que se ve antes de darle "enviar" es literalmente el correo, no una
 * aproximación — se arma con la misma función que usa el envío.
 */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "crm")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  const mensaje = String(b.mensaje || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del contacto." }, { status: 400 });
  if (!mensaje) return NextResponse.json({ error: "El mensaje está vacío." }, { status: 400 });

  const d = await datosRecompra(supabaseAdmin(), id);
  if (!d) return NextResponse.json({ error: "Ese contacto no tiene compras." }, { status: 400 });

  const mail = correoRecompra(d, mensaje);
  return NextResponse.json({ ...mail, para: d.email });
}
