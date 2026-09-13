import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

export const dynamic = "force-dynamic";

// Guarda los ajustes de las bolsas (una sola fila, id = 1; supabase-bolsas.sql).
export async function PUT(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const pct = (v: unknown) => { const n = Number(v); return isFinite(n) && n >= 0 && n <= 100 ? n : null; };
  const monto = (v: unknown) => { const n = Number(v); return isFinite(n) && n >= 0 ? n : null; };

  const impuestos = pct(b.impuestos_pct), colchon = pct(b.colchon_pct);
  const meta = monto(b.colchon_meta), inicial = monto(b.colchon_inicial);
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(String(b.inicio || "")) ? String(b.inicio) : null;
  if (impuestos === null || colchon === null) return NextResponse.json({ error: "Los porcentajes van de 0 a 100." }, { status: 400 });
  if (meta === null || inicial === null) return NextResponse.json({ error: "La meta y el saldo inicial no pueden ser negativos." }, { status: 400 });
  if (!inicio) return NextResponse.json({ error: "Falta la fecha de inicio." }, { status: 400 });

  const escalones = (Array.isArray(b.escalones) ? b.escalones : [])
    .slice(0, 6)
    .map((e: { desde?: unknown; semanal?: unknown }) => ({ desde: monto(e?.desde), semanal: monto(e?.semanal) }))
    .filter((e: { desde: number | null; semanal: number | null }) => e.desde !== null && e.semanal !== null && e.semanal > 0);
  if (!escalones.length) return NextResponse.json({ error: "Pon al menos un escalón de sueldo." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("finanzas_ajustes").upsert({
    id: 1,
    impuestos_pct: impuestos,
    colchon_pct: colchon,
    colchon_meta: meta,
    colchon_inicial: inicial,
    inicio,
    escalones,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  });
  if (error) {
    const falta = /finanzas_ajustes/.test(error.message) && /(does not exist|schema cache)/i.test(error.message);
    return NextResponse.json(
      { error: falta ? "Falta correr supabase-bolsas.sql en Supabase." : error.message },
      { status: falta ? 409 : 500 },
    );
  }

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "finanzas_ajustes_editados",
      titulo: `${quien} cambió los ajustes de las bolsas (impuestos ${impuestos}%, colchón ${colchon}%)`,
      actor, entidad: "reparto", entidad_nombre: "Bolsas",
      meta: { impuestos, colchon, meta, inicial, inicio, escalones },
    });
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}
