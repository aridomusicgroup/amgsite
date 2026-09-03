import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Normaliza instrumentos: acepta array o texto ("tololoche, bajo") → string[] limpio. */
function parseInstrumentos(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : String(v || "").split(/[\n,;]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const s = String(x || "").trim();
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  return out;
}

const SEL = "id, nombre, instrumentos, tarifa, telefono, email, activo, nota";

// ── GET: catálogo de músicos (todos; el cliente filtra activos si quiere) ──
export async function GET() {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("musicos").select(SEL).order("nombre", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ musicos: data ?? [] });
}

// ── POST: agrega un músico ──
export async function POST(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const nombre = String(b.nombre || "").trim();
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb.from("musicos").insert({
    nombre,
    instrumentos: parseInstrumentos(b.instrumentos),
    tarifa: Number(b.tarifa) || 0,
    telefono: (b.telefono || "").trim() || null,
    email: (b.email || "").trim().toLowerCase() || null,
    nota: (b.nota || "").trim() || null,
    activo: b.activo === undefined ? true : Boolean(b.activo),
  }).select(SEL).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, musico: data });
}

// ── PATCH: edita un músico ──
export async function PATCH(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("nombre" in b) { const n = String(b.nombre || "").trim(); if (!n) return NextResponse.json({ error: "Nombre inválido." }, { status: 400 }); patch.nombre = n; }
  if ("instrumentos" in b) patch.instrumentos = parseInstrumentos(b.instrumentos);
  if (b.tarifa !== undefined) patch.tarifa = Number(b.tarifa) || 0;
  if ("telefono" in b) patch.telefono = b.telefono ? String(b.telefono).trim() : null;
  if ("email" in b) patch.email = b.email ? String(b.email).trim().toLowerCase() : null;
  if ("nota" in b) patch.nota = b.nota ? String(b.nota).trim() : null;
  if ("activo" in b) patch.activo = Boolean(b.activo);

  const sb = supabaseAdmin();
  const { data, error } = await sb.from("musicos").update(patch).eq("id", id).select(SEL).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, musico: data });
}

// ── DELETE: quita un músico ──
export async function DELETE(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = String((await req.json().catch(() => ({}))).id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  const sb = supabaseAdmin();
  const { error } = await sb.from("musicos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
