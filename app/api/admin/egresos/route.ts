import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

const peso = (n: unknown) => `$${(Number(n) || 0).toLocaleString("es-MX")}`;

// Registra un egreso nuevo desde el panel.
export async function POST(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const total = Number(b.total_mxn);
  if (!b.fecha || !(total > 0)) {
    return NextResponse.json({ error: "Faltan datos (fecha o total en MXN)." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Folio: continúa la serie E#### del sheet
  const { data: ult } = await sb
    .from("egresos")
    .select("folio")
    .like("folio", "E%")
    .order("folio", { ascending: false })
    .limit(1);
  let folio = "E0001";
  const prev = ult?.[0]?.folio;
  if (prev) {
    const n = parseInt(prev.replace(/\D/g, ""), 10);
    if (!isNaN(n)) folio = "E" + String(n + 1).padStart(4, "0");
  }

  const { error } = await sb.from("egresos").insert({
    folio,
    fecha: b.fecha,
    categoria: b.categoria || null,
    proveedor: b.proveedor || null,
    descripcion: b.descripcion || null,
    monto_sin_iva: Number(b.monto_sin_iva) || null,
    iva: Number(b.iva) || 0,
    total_mxn: total,
    es_capex: Boolean(b.es_capex),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "egreso_creado",
      titulo: `${quien} registró el egreso ${folio} — ${b.categoria || b.descripcion || "gasto"} · ${peso(total)}${b.proveedor ? ` (${b.proveedor})` : ""}`,
      actor, entidad: "egreso", entidad_nombre: folio,
      meta: { total_mxn: total, categoria: b.categoria ?? null, es_capex: Boolean(b.es_capex) },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, folio });
}

// ── Editar un egreso (solo admin total) ──
export async function PATCH(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del egreso." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (b.fecha) patch.fecha = b.fecha;
  for (const k of ["categoria", "proveedor", "descripcion"]) if (k in b) patch[k] = b[k] ? b[k] : null;
  if (b.total_mxn !== undefined && b.total_mxn !== "") patch.total_mxn = Number(b.total_mxn) || 0;
  if (b.monto_sin_iva !== undefined) patch.monto_sin_iva = b.monto_sin_iva === "" ? null : Number(b.monto_sin_iva) || null;
  if (b.iva !== undefined) patch.iva = Number(b.iva) || 0;
  if ("es_capex" in b) patch.es_capex = Boolean(b.es_capex);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: upd, error } = await sb.from("egresos").update(patch).eq("id", id).select("folio").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const actor = await getFullAdminEmail();
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "egreso_editado",
      titulo: `${quien} editó el egreso ${upd?.folio ?? ""} (${Object.keys(patch).join(", ")})`,
      actor, entidad: "egreso", entidad_id: id, entidad_nombre: (upd?.folio as string) ?? null,
      meta: patch,
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}

// ── Eliminar un egreso (solo admin total) ──
export async function DELETE(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del egreso." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: eg } = await sb.from("egresos").select("folio, total_mxn").eq("id", id).single();
  const { error } = await sb.from("egresos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "egreso_eliminado",
      titulo: `${quien} eliminó el egreso ${eg?.folio ?? ""}${eg?.total_mxn ? ` · ${peso(eg.total_mxn)}` : ""}`,
      actor, entidad: "egreso", entidad_id: id, entidad_nombre: (eg?.folio as string) ?? null,
    });
  } catch { /* bitácora best-effort */ }
  return NextResponse.json({ ok: true });
}
