import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateQuotePdf, QuoteItem } from "@/lib/pdf/quote";
import { getCotizacionTerminos } from "@/lib/plantillas-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || (s.role !== "admin" && s.role !== "crm")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = String(new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: c } = await sb.from("cotizaciones").select("*").eq("id", id).single();
  if (!c) return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });

  const items = (Array.isArray(c.items) ? c.items : []) as QuoteItem[];
  const terminos = await getCotizacionTerminos();
  const bytes = await generateQuotePdf({
    folio: (c.folio as string) || "COT",
    fecha: c.created_at ? new Date(c.created_at as string) : new Date(),
    vigenciaDias: Number(c.vigencia_dias) || 15,
    moneda: (c.moneda as string) || "MXN",
    cliente: {
      nombre: (c.cliente_nombre as string | null) ?? null,
      email: (c.cliente_email as string | null) ?? null,
      telefono: (c.cliente_telefono as string | null) ?? null,
      direccion: (c.cliente_direccion as string | null) ?? null,
    },
    items,
    descuento: Number(c.descuento) || 0,
    comisionPct: Number(c.comision_pct) || 0,
    notas: (c.notas as string | null) ?? null,
    terminos,
    esquemaPago: (c.esquema_pago as string | null) ?? null,
    numCanciones: c.num_canciones != null ? Number(c.num_canciones) : null,
    descuentoFidelidad: Number(c.descuento_fidelidad) || 0,
    creditoAplicado: Number(c.credito_aplicado) || 0,
  });

  const nombre = `Cotizacion ${(c.folio as string) || ""}`.trim().replace(/[\\/:*?"<>|]/g, "");
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nombre}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
