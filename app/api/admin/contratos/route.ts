import { NextRequest, NextResponse } from "next/server";
import { aMxn } from "@/lib/tipo-cambio";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nextFolio } from "@/lib/folio";
import { CONTRATO_ESTADOS } from "@/lib/cotizaciones-data";
import { CONTRACT_LABELS, ContractTipo } from "@/lib/pdf/contracts";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

const TIPOS = Object.keys(CONTRACT_LABELS) as ContractTipo[];

interface ItemIn { label?: unknown; qty?: unknown; unitPrice?: unknown }
function parseItems(v: unknown): { label: string; qty: number; unitPrice: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: ItemIn) => ({
      label: String(x?.label ?? "").trim(),
      qty: Math.max(0, Number(x?.qty) || 0),
      unitPrice: Math.max(0, Number(x?.unitPrice) || 0),
    }))
    .filter((i) => i.label);
}

async function staff(): Promise<string | null> {
  const s = await getSession();
  return s && (s.role === "admin" || s.role === "crm") ? s.email : null;
}

export async function POST(req: NextRequest) {
  const email = await staff();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const tipo: ContractTipo = TIPOS.includes(b.tipo) ? b.tipo : "generico";
  const concepto = (b.concepto || "").trim();
  if (!concepto && tipo !== "generico") {
    return NextResponse.json({ error: "Falta el concepto (beat/producción/servicio)." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const folio = await nextFolio(sb, "contratos", "CONT-");
  const { data, error } = await sb.from("contratos").insert({
    folio,
    tipo,
    cotizacion_id: b.cotizacion_id || null,
    venta_id: b.venta_id || null,
    proyecto_id: b.proyecto_id || null,
    contacto_id: b.contacto_id || null,
    cliente_nombre: (b.cliente_nombre || "").trim() || null,
    cliente_email: (b.cliente_email || "").trim().toLowerCase() || null,
    cliente_telefono: (b.cliente_telefono || "").trim() || null,
    cliente_direccion: (b.cliente_direccion || "").trim() || null,
    moneda: String(b.moneda || "MXN").toUpperCase().slice(0, 4),
    monto: Math.max(0, Number(b.monto) || 0),
    tipo_cambio: Number(b.tipo_cambio) > 0 ? Number(b.tipo_cambio) : null,
    // Espejo en pesos: es lo que leen el Dashboard y Finanzas, que reportan en
    // MXN. Se guarda calculado para que el contrato conserve el tipo de cambio
    // con el que se pactó, aunque el dólar se mueva después.
    monto_mxn: aMxn(Math.max(0, Number(b.monto) || 0), b.moneda, Number(b.tipo_cambio) || 0),
    concepto: concepto || null,
    items: parseItems(b.items),
    clausulas_extra: (b.clausulas_extra || "").trim() || null,
    notas: (b.notas || "").trim() || null,
    estado: CONTRATO_ESTADOS.includes(b.estado) ? b.estado : "borrador",
    creado_por: email,
  }).select("id, folio").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, email);
    await registrarActividad(sb, {
      tipo: "contrato_creado",
      titulo: `${quien} creó el contrato ${data.folio} — ${CONTRACT_LABELS[tipo] ?? tipo}${b.cliente_nombre ? ` (${b.cliente_nombre})` : ""}`,
      actor: email, entidad: "contrato", entidad_id: data.id as string, entidad_nombre: data.folio as string,
      meta: { tipo, monto: b.monto ?? null },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, id: data.id, folio: data.folio });
}

export async function PATCH(req: NextRequest) {
  const email = await staff();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["cliente_nombre", "cliente_email", "cliente_telefono", "cliente_direccion", "concepto", "clausulas_extra", "notas", "contacto_id"]) {
    if (k in b) patch[k] = b[k] ? String(b[k]).trim() : null;
  }
  if ("moneda" in b) patch.moneda = String(b.moneda || "MXN").toUpperCase().slice(0, 4);
  if ("monto" in b) patch.monto = Math.max(0, Number(b.monto) || 0);
  if ("tipo_cambio" in b) patch.tipo_cambio = Number(b.tipo_cambio) > 0 ? Number(b.tipo_cambio) : null;
  // El espejo en pesos se rehace si cambió cualquiera de sus tres ingredientes.
  if ("monto" in b || "moneda" in b || "tipo_cambio" in b) {
    patch.monto_mxn = aMxn(
      Number(patch.monto ?? b.monto) || 0,
      (patch.moneda as string) ?? b.moneda,
      Number(patch.tipo_cambio ?? b.tipo_cambio) || 0,
    );
  }
  if ("items" in b) patch.items = parseItems(b.items);
  if (b.tipo && TIPOS.includes(b.tipo)) patch.tipo = b.tipo;
  if (b.estado && CONTRATO_ESTADOS.includes(b.estado)) patch.estado = b.estado;

  const sb = supabaseAdmin();
  const { error } = await sb.from("contratos").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = String(new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  const sb = supabaseAdmin();
  const { error } = await sb.from("contratos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
