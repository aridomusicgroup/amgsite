import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { upsertClienteProfile } from "@/lib/cuenta-cliente";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Guarda los datos del cliente en su ficha del CRM (contactos). */
export async function POST(req: NextRequest) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const nombre = String(b.nombre ?? "").trim();
  const direccion = String(b.direccion ?? "").trim();
  const telefono = String(b.telefono ?? "").trim();
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });

  await upsertClienteProfile(email, { nombre, direccion, telefono });
  return NextResponse.json({ ok: true });
}
