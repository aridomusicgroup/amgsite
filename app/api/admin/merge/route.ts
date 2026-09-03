import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TABLAS_DEL_CONTACTO, heredarSeguimiento } from "@/lib/fusionar-contactos";

export const dynamic = "force-dynamic";

const ETAPA_ORDER: Record<string, number> = { recurrente: 5, cliente: 4, negociacion: 3, lead: 2, perdido: 1, inactivo: 0 };

// Fusiona MANUALMENTE los contactos indicados (ej. "Jehu" + "Jehu Núñez").
// Conserva la ficha más completa, le deja el nombre más largo, consolida
// email/teléfono/ventas y oculta las demás con merged_into (reversible).
export async function POST(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { ids } = await req.json().catch(() => ({ ids: [] }));
  if (!Array.isArray(ids) || ids.length < 2) {
    return NextResponse.json({ error: "Selecciona al menos 2 contactos." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("contactos")
    .select("id, nombre, email, telefono, etapa, origen, ltv, created_at")
    .in("id", ids)
    .is("merged_into", null);
  const miembros = data ?? [];
  if (miembros.length < 2) {
    return NextResponse.json({ error: "Se necesitan 2 contactos válidos." }, { status: 400 });
  }

  // Sobreviviente: más LTV → con email → más antiguo
  miembros.sort((a, b) =>
    (Number(b.ltv) || 0) - (Number(a.ltv) || 0) ||
    (b.email ? 1 : 0) - (a.email ? 1 : 0) ||
    String(a.created_at).localeCompare(String(b.created_at))
  );
  const surv = miembros[0];
  const losers = miembros.slice(1);

  // Nombre: el más completo (más largo) del grupo
  const nombre = miembros
    .map((m) => (m.nombre || "").trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || surv.nombre;
  const email = surv.email || losers.find((l) => l.email)?.email || null;
  const telefono = surv.telefono || losers.find((l) => l.telefono)?.telefono || null;
  const origen = surv.origen || losers.find((l) => l.origen)?.origen || null;
  const etapaBest = miembros.reduce((best, m) => (ETAPA_ORDER[m.etapa] > ETAPA_ORDER[best] ? m.etapa : best), surv.etapa);

  for (const l of losers) {
    for (const t of TABLAS_DEL_CONTACTO) {
      await sb.from(t).update({ contacto_id: surv.id }).eq("contacto_id", l.id);
    }
    await heredarSeguimiento(sb, l.id, surv.id);
    await sb.from("contactos").update({ merged_into: surv.id }).eq("id", l.id);
  }

  const { data: vts } = await sb.from("ventas").select("total_mxn").eq("contacto_id", surv.id);
  const sum = (vts ?? []).reduce((a, v) => a + (Number(v.total_mxn) || 0), 0);
  const n = (vts ?? []).length;
  await sb.from("contactos").update({
    nombre, email, telefono, origen,
    etapa: n > 1 ? "recurrente" : n === 1 ? "cliente" : etapaBest,
    ltv: sum,
    updated_at: new Date().toISOString(),
  }).eq("id", surv.id);

  return NextResponse.json({ ok: true, survivor: nombre, fusionados: losers.length });
}
