import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { generateContractPdfFromText, ContractTipo } from "@/lib/pdf/contracts";
import { generateQuotePdf } from "@/lib/pdf/quote";
import { SEEDS } from "@/lib/pdf/plantilla-seeds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONTRATO_TIPOS = new Set(Object.keys(SEEDS));

/** Datos de ejemplo para previsualizar una plantilla sin datos reales. */
const CLIENTE_DEMO = {
  nombre: "Juan Pérez López",
  email: "cliente@ejemplo.com",
  telefono: "+52 55 1234 5678",
  direccion: "Av. Ejemplo #123, Col. Centro, Ciudad de México, C.P. 06000",
};

/** Genera un PDF de ejemplo con el texto que el editor tiene en pantalla. */
export async function POST(req: NextRequest) {
  const email = await getFullAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const tipo = String(b.tipo || "").trim();

  let bytes: Uint8Array;

  if (tipo === "cotizacion") {
    const terminos = String(b.terminos || b.cuerpo || "").trim();
    bytes = await generateQuotePdf({
      folio: "COT-EJEMPLO",
      fecha: new Date(),
      vigenciaDias: 15,
      moneda: "MXN",
      cliente: CLIENTE_DEMO,
      items: [
        { label: "Beat exclusivo (corridos)", qty: 1, unitPrice: 3500 },
        { label: "Producción a la medida", qty: 1, unitPrice: 8600 },
      ],
      notas: "Ejemplo de cotización para previsualizar los términos.",
      terminos,
    });
  } else if (CONTRATO_TIPOS.has(tipo)) {
    const titulo = String(b.titulo || SEEDS[tipo as ContractTipo].titulo).trim();
    const cuerpo = String(b.cuerpo || "").trim();
    if (!cuerpo) return NextResponse.json({ error: "El cuerpo está vacío." }, { status: 400 });
    const moneda = tipo === "exclusiva" ? "USD" : "MXN";
    bytes = await generateContractPdfFromText(titulo, cuerpo, {
      folio: "CONT-EJEMPLO",
      fecha: new Date(),
      moneda,
      monto: tipo === "exclusiva" ? 600 : 8600,
      concepto: "Beat de ejemplo",
      cliente: CLIENTE_DEMO,
    });
  } else {
    return NextResponse.json({ error: "Tipo de plantilla inválido." }, { status: 400 });
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ejemplo-${tipo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
