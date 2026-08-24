import { NextRequest, NextResponse } from "next/server";
import { getCustomerEmail } from "@/lib/cuenta-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateContractPdf, ContractTipo } from "@/lib/pdf/contracts";
import { QuoteItem } from "@/lib/pdf/quote";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** PDF del contrato del propio cliente (solo si su correo coincide y no es borrador). */
export async function GET(req: NextRequest) {
  const email = await getCustomerEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = String(new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: c } = await sb.from("contratos").select("*").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });

  // Autorización: el contrato debe ser de este cliente y estar compartido (no borrador).
  if ((c.cliente_email as string | null)?.toLowerCase() !== email.toLowerCase() || c.estado === "borrador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const bytes = await generateContractPdf((c.tipo as ContractTipo) || "generico", {
    folio: (c.folio as string) || "CONT",
    fecha: c.created_at ? new Date(c.created_at as string) : new Date(),
    moneda: (c.moneda as string) || "MXN",
    monto: Number(c.monto) || 0,
    concepto: (c.concepto as string | null) ?? undefined,
    cliente: {
      nombre: (c.cliente_nombre as string | null) ?? null,
      email: (c.cliente_email as string | null) ?? null,
      telefono: (c.cliente_telefono as string | null) ?? null,
      direccion: (c.cliente_direccion as string | null) ?? null,
    },
    items: (Array.isArray(c.items) ? c.items : []) as QuoteItem[],
    clausulasExtra: (c.clausulas_extra as string | null) ?? null,
  });

  const nombre = `Contrato ${(c.folio as string) || ""}`.trim().replace(/[\\/:*?"<>|]/g, "");
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
