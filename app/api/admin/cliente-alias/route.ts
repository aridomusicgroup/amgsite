import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const clean = (e: unknown) => String(e ?? "").trim().toLowerCase();
const isEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// ── GET ?principal= : correos adicionales ligados a un correo principal ──
export async function GET(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const principal = clean(new URL(req.url).searchParams.get("principal"));
  if (!principal) return NextResponse.json({ error: "Falta el correo principal." }, { status: 400 });
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("cliente_alias").select("alias_email").eq("principal_email", principal).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ correos: (data ?? []).map((r) => r.alias_email as string) });
}

// ── POST : liga un correo adicional a un principal ──
export async function POST(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const principal = clean(b.principal_email);
  const alias = clean(b.alias_email);
  if (!isEmail(principal) || !isEmail(alias)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  if (principal === alias) return NextResponse.json({ error: "El correo adicional debe ser distinto al principal." }, { status: 400 });

  const sb = supabaseAdmin();
  // Un alias apunta a un solo principal (llave primaria = alias_email → upsert).
  const { error } = await sb.from("cliente_alias").upsert(
    { alias_email: alias, principal_email: principal },
    { onConflict: "alias_email" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ── DELETE : quita un correo adicional ──
export async function DELETE(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const alias = clean(b.alias_email || new URL(req.url).searchParams.get("alias_email"));
  if (!alias) return NextResponse.json({ error: "Falta el correo." }, { status: 400 });
  const sb = supabaseAdmin();
  const { error } = await sb.from("cliente_alias").delete().eq("alias_email", alias);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
