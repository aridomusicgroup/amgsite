import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { productoAviso } from "@/lib/curso-preventa";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * “Avísame” público de la página de venta: guarda el correo en la lista del
 * curso (una sola vez por correo). Se le escribe 2 días antes de que cierre la
 * preventa y el día que abra. Sin sesión: lo cuidan el límite por IP y la trampa.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`aviso:${clientIp(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "Demasiados intentos. Prueba en un rato." }, { status: 429 });
  }
  const b = (await req.json().catch(() => ({}))) as { curso_id?: unknown; email?: unknown; website?: unknown };
  // Un bot llenó el campo oculto: se le contesta “ok” y no se guarda nada.
  if (typeof b.website === "string" && b.website.trim()) return NextResponse.json({ ok: true });

  const cursoId = String(b.curso_id ?? "");
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!UUID.test(cursoId)) return NextResponse.json({ error: "Curso inválido." }, { status: 400 });
  if (email.length > 200 || !EMAIL.test(email)) return NextResponse.json({ error: "Revisa tu correo." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: c } = await sb.from("cursos").select("id, activo, tipo").eq("id", cursoId).maybeSingle();
  if (!c || !c.activo || c.tipo === "mentoria") return NextResponse.json({ error: "Curso no encontrado." }, { status: 404 });

  const { error } = await sb.from("curso_interes").upsert(
    { producto: productoAviso(cursoId), email, curso_id: cursoId },
    { onConflict: "producto,email", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
