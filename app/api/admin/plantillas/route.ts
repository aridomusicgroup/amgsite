import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SEEDS } from "@/lib/pdf/plantilla-seeds";
import { SEEDS as ACUERDO_SEEDS } from "@/lib/acuerdos/seeds";
import { FAMILIAS, type Familia } from "@/lib/acuerdos/familias";

export const dynamic = "force-dynamic";

// `acuerdo_<familia>` no son contratos en PDF: son los acuerdos que el cliente
// acepta al entrar a su panel, uno por tipo de servicio. Viven aquí para
// poder editarlos sin desplegar, pero NO entran en ContractTipo para no
// aparecer como tipo de contrato en cotizaciones.
const ACUERDO_TIPOS = FAMILIAS.map((f) => `acuerdo_${f}`);
const TIPOS = new Set([...Object.keys(SEEDS), "cotizacion", ...ACUERDO_TIPOS]);

/** `acuerdo_personalizado` → `personalizado`, o `null` si no es un acuerdo. */
const familiaDelTipo = (tipo: string): Familia | null => {
  const m = tipo.match(/^acuerdo_(.+)$/);
  const f = m?.[1];
  return f && (FAMILIAS as string[]).includes(f) ? (f as Familia) : null;
};

/** Guarda (upsert) una plantilla editada. Sólo admin. */
export async function PUT(req: NextRequest) {
  const email = await getFullAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const tipo = String(b.tipo || "").trim();
  if (!TIPOS.has(tipo)) return NextResponse.json({ error: "Tipo de plantilla inválido." }, { status: 400 });

  const row: Record<string, unknown> = { tipo, updated_at: new Date().toISOString(), updated_por: email };
  if (tipo === "cotizacion") {
    const terminos = String(b.terminos || b.cuerpo || "").trim();
    if (!terminos) return NextResponse.json({ error: "Los términos no pueden quedar vacíos." }, { status: 400 });
    row.terminos = terminos;
  } else {
    const titulo = String(b.titulo || "").trim();
    const cuerpo = String(b.cuerpo || "").trim();
    if (!cuerpo) return NextResponse.json({ error: "El cuerpo no puede quedar vacío." }, { status: 400 });
    const familia = familiaDelTipo(tipo);
    row.titulo = titulo || (familia ? ACUERDO_SEEDS[familia].titulo : SEEDS[tipo as keyof typeof SEEDS].titulo);
    row.cuerpo = cuerpo;
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("plantillas").upsert(row, { onConflict: "tipo" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Restaura la plantilla a su semilla (borra la fila editada). Sólo admin. */
export async function DELETE(req: NextRequest) {
  const email = await getFullAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const tipo = String(new URL(req.url).searchParams.get("tipo") || "").trim();
  if (!TIPOS.has(tipo)) return NextResponse.json({ error: "Tipo de plantilla inválido." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("plantillas").delete().eq("tipo", tipo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
