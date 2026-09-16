import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clasificarReel, esTipoReel } from "@/lib/tipo-reel";

export const dynamic = "force-dynamic";

/** Quien registra clientes o ventas: admin o CRM (Tozi). */
async function staff(): Promise<string | null> {
  const s = await getSession();
  return s && (s.role === "admin" || s.role === "crm") ? s.email : null;
}

/**
 * GET: los reels recientes, para elegir de cuál llegó un cliente.
 * Cada uno con su tipo (el elegido a mano, o el que propone la descripción).
 */
export async function GET(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limite = Math.min(150, Math.max(1, Number(new URL(req.url).searchParams.get("limite")) || 60));

  const sb = supabaseAdmin();
  const BASE = "id, caption, publicado_at, thumbnail_url, permalink, reproducciones";
  const leer = (cols: string) => sb.from("social_posts").select(cols)
    .order("publicado_at", { ascending: false }).limit(limite);
  // `tipo_contenido` es columna nueva: sin ella, la lista sale igual.
  let { data, error } = await leer(`${BASE}, tipo_contenido, tipo_manual`);
  if (error) ({ data, error } = await leer(BASE));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reels = ((data ?? []) as unknown as Record<string, unknown>[]).map((p) => {
    const manual = Boolean(p.tipo_manual) && esTipoReel(p.tipo_contenido);
    return {
      id: p.id as string,
      caption: (p.caption as string | null) ?? "",
      publicado_at: (p.publicado_at as string | null) ?? null,
      thumbnail: (p.thumbnail_url as string | null) ?? null,
      permalink: (p.permalink as string | null) ?? null,
      reproducciones: Number(p.reproducciones) || 0,
      tipo: manual ? (p.tipo_contenido as string) : clasificarReel(p.caption as string | null),
      tipoManual: manual,
    };
  });
  return NextResponse.json({ reels });
}

/** PATCH { id, tipo }: una persona fija el tipo de un reel (null = volver al automático). */
export async function PATCH(req: NextRequest) {
  if (!(await staff())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Falta el reel." }, { status: 400 });

  const tipo = b.tipo == null || b.tipo === "" ? null : b.tipo;
  if (tipo !== null && !esTipoReel(tipo)) return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });

  const { error } = await supabaseAdmin().from("social_posts")
    .update({ tipo_contenido: tipo, tipo_manual: tipo !== null }).eq("id", id);
  if (error) {
    const falta = /tipo_contenido|tipo_manual/i.test(error.message);
    return NextResponse.json(
      { error: falta ? "Falta correr supabase-origen-clientes.sql." : error.message },
      { status: falta ? 503 : 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
