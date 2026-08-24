import { NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const norm = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
const ETAPA_ORDER: Record<string, number> = { recurrente: 5, cliente: 4, negociacion: 3, lead: 2, perdido: 1, inactivo: 0 };

interface C {
  id: string; nombre: string | null; email: string | null; telefono: string | null;
  etapa: string; origen: string | null; ltv: number; created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fusiona contactos duplicados por NOMBRE normalizado (ej. el mismo cliente que
// llegó por nombre del sheet y por email del CSV de BeatStars). Conserva al más
// completo, le pasa email/teléfono/ventas, y marca a los demás con merged_into
// (quedan ocultos, no se borran → reversible). Re-ejecutable.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST() {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("contactos")
      .select("id, nombre, email, telefono, etapa, origen, ltv, created_at")
      .is("merged_into", null);
    const contactos = (data ?? []).map((c) => ({ ...c, ltv: Number(c.ltv) || 0 })) as C[];

    // Agrupa por nombre normalizado (ignora sin nombre o muy corto)
    const grupos = new Map<string, C[]>();
    for (const c of contactos) {
      const key = norm(c.nombre);
      if (key.length < 4) continue;
      const arr = grupos.get(key);
      if (arr) arr.push(c);
      else grupos.set(key, [c]);
    }

    let gruposFusionados = 0, contactosFusionados = 0;

    for (const [, miembros] of grupos) {
      if (miembros.length < 2) continue;
      // Sobreviviente: más LTV → con email → más antiguo
      miembros.sort((a, b) =>
        b.ltv - a.ltv ||
        (b.email ? 1 : 0) - (a.email ? 1 : 0) ||
        a.created_at.localeCompare(b.created_at)
      );
      const surv = miembros[0];
      const losers = miembros.slice(1);

      const email = surv.email || losers.find((l) => l.email)?.email || null;
      const telefono = surv.telefono || losers.find((l) => l.telefono)?.telefono || null;
      const origen = surv.origen || losers.find((l) => l.origen)?.origen || null;
      const etapa = miembros.reduce((best, m) => (ETAPA_ORDER[m.etapa] > ETAPA_ORDER[best] ? m.etapa : best), surv.etapa);

      for (const l of losers) {
        await sb.from("ventas").update({ contacto_id: surv.id }).eq("contacto_id", l.id);
        await sb.from("identidades_canal").update({ contacto_id: surv.id }).eq("contacto_id", l.id);
        await sb.from("interacciones").update({ contacto_id: surv.id }).eq("contacto_id", l.id);
        await sb.from("contactos").update({ merged_into: surv.id }).eq("id", l.id);
        contactosFusionados++;
      }

      // Recalcula LTV/etapa del sobreviviente con sus ventas ya consolidadas
      const { data: vts } = await sb.from("ventas").select("total_mxn").eq("contacto_id", surv.id);
      const sum = (vts ?? []).reduce((a, v) => a + (Number(v.total_mxn) || 0), 0);
      const n = (vts ?? []).length;
      await sb.from("contactos").update({
        email, telefono, origen,
        etapa: n > 1 ? "recurrente" : n === 1 ? "cliente" : etapa,
        ltv: sum,
        updated_at: new Date().toISOString(),
      }).eq("id", surv.id);

      gruposFusionados++;
    }

    return NextResponse.json({ ok: true, summary: { gruposFusionados, contactosFusionados } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
