import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * El mapa instrumento → pista de REAPER.
 *
 * Lo lee `reaper-sync/musicos.js` para decidir dónde meter la grabación que
 * mandó un músico. Sin fila para un instrumento, el audio entra en una pista
 * nueva al final del proyecto — nunca se adivina.
 *
 * La lista de pistas sugeridas sale de `render_inventario`, que es lo que el
 * script local ya escanea de los .rpp reales. Son nombres que EXISTEN en tus
 * proyectos, no los de la plantilla: los proyectos se desvían de ella (uno
 * tiene 57 pistas contra las 47 de la plantilla, con nombres inventados).
 */

const MAX = 200;

/** Igual que `limpiaNombre` de reaper-sync: en el .rpp es "BAJO/TOLO" y el panel lo muestra "BAJO-TOLO". */
const normaliza = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").trim().toUpperCase();

export async function GET() {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = supabaseAdmin();

  // `canales` es columna nueva: si la migración aún no corre, pedirla haría
  // fallar la consulta ENTERA y esta sección se vería vacía como si no hubiera
  // equivalencias. Se reintenta sin ella.
  const conCanales = () => sb.from("instrumento_pistas").select("instrumento, pista, canales").order("instrumento");
  const sinCanales = () => sb.from("instrumento_pistas").select("instrumento, pista").order("instrumento");
  const [mapaRes, invRes] = await Promise.all([
    conCanales().then((r) => (r.error ? sinCanales() : r)),
    sb.from("render_inventario").select("proyectos").limit(120),
  ]);
  if (mapaRes.error) return NextResponse.json({ error: mapaRes.error.message }, { status: 500 });

  const vistas = new Set<string>();
  for (const fila of invRes.data ?? []) {
    const proyectos = (fila.proyectos as { pistas?: { nombre?: string }[] }[] | null) ?? [];
    for (const p of proyectos) for (const t of p.pistas ?? []) {
      const n = String(t?.nombre ?? "").trim();
      // Se filtra la basura que deja el flujo real: mixdowns exportados,
      // archivos sueltos y pistas sin nombre no son destinos plausibles.
      if (n && n.length <= 30 && !/\.(wav|mp3)$/i.test(n) && !/^-|export|renderiz/i.test(n)) vistas.add(n);
    }
  }

  // Se marca cuáles apuntan a una pista que EXISTE hoy en algún proyecto. Una
  // equivalencia puede escribirse antes de que la pista exista (para cuando se
  // grabe ese paquete); saberlo evita creer que algo está mal configurado.
  const conocidas = new Set([...vistas].map(normaliza));
  const mapa = (mapaRes.data ?? []).map((f) => ({
    instrumento: f.instrumento as string,
    pista: f.pista as string,
    canales: ((f as Record<string, unknown>).canales as string | null) ?? "",
    existe: String(f.pista).split(",").some((c) => c.trim() && conocidas.has(normaliza(c))),
  }));

  return NextResponse.json({
    mapa,
    pistasVistas: [...vistas].sort((a, b) => a.localeCompare(b, "es")),
  });
}

/** POST: crea o actualiza una equivalencia (el instrumento es la llave). */
export async function POST(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const instrumento = String(b.instrumento || "").trim().slice(0, MAX);
  const pista = String(b.pista || "").trim().slice(0, MAX);
  // Canales: hijas DIRECTAS de la carpeta destino, en el orden en que el músico
  // las va a ver en su portal. Vacío = una sola pista, nueva.
  const canales = String(b.canales ?? "").trim().slice(0, MAX) || null;
  if (!instrumento || !pista) return NextResponse.json({ error: "Pon el instrumento y la pista." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("instrumento_pistas")
    .upsert({ instrumento, pista, canales, updated_at: new Date().toISOString() }, { onConflict: "instrumento" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE: quita la equivalencia — ese instrumento vuelve a caer en pista nueva. */
export async function DELETE(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const instrumento = new URL(req.url).searchParams.get("instrumento");
  if (!instrumento) return NextResponse.json({ error: "Falta el instrumento." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("instrumento_pistas").delete().eq("instrumento", instrumento);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
