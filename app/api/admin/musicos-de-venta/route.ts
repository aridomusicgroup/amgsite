import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Quién se contrató para ESTE proyecto, y para qué instrumento.
 *
 * Resuelve la ambigüedad del catálogo: ahí hay dos tololoches (Adal Oche y
 * Ángel Rocha) y dos trombones (Jorge Orlando y Samuel Torres), así que
 * "¿quién toca el tololoche?" no tiene una respuesta sola. La venta sí la
 * tiene — en EL NECIO son Martín en charchetas y Adal en tololoche.
 *
 * El camino es `proyectos.venta_id → pagos_musico`, que es donde ya queda
 * registrado a quién se le va a pagar y por qué. El instrumento viene en la
 * nota como "Auto: Charchetas", que es como lo escribe `musicos-sync.ts` al
 * crear los pagos pendientes desde los extras de la venta.
 *
 * Ojo con la liga: `pagos_musico.musico` es TEXTO, no una llave a `musicos.id`
 * (deuda vieja). Se casa por nombre normalizado; si alguien tuvo un dedazo al
 * capturar el pago, ese músico simplemente no sale aquí y se elige a mano.
 */

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();

/** El instrumento que quedó anotado en el pago ("Auto: Charchetas" → "Charchetas"). */
const instrumentoDe = (nota: string | null): string | null => {
  const m = /^auto:\s*(.+)$/i.exec(String(nota ?? "").trim());
  return m ? m[1].trim() : null;
};

export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const proyectoId = new URL(req.url).searchParams.get("proyecto_id");
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: p } = await sb.from("proyectos").select("venta_id").eq("id", proyectoId).maybeSingle();
  // Sin venta no hay a quién buscar: es un proyecto interno o de catálogo.
  if (!p?.venta_id) return NextResponse.json({ musicos: [] });

  // `musico_id` e `instrumento` son columnas nuevas: si la migración todavía no
  // corre, pedirlas haría fallar la consulta entera y el selector se quedaría
  // sin los contratados. Se reintenta con las viejas.
  const conLlave = () => sb.from("pagos_musico").select("musico, nota, musico_id, instrumento").eq("venta_id", p.venta_id!);
  const sinLlave = () => sb.from("pagos_musico").select("musico, nota").eq("venta_id", p.venta_id!);
  const [pagosRes, catRes] = await Promise.all([
    conLlave().then((r) => (r.error ? sinLlave() : r)),
    sb.from("musicos").select("id, nombre, email, instrumentos, activo, portal_activo"),
  ]);

  const catalogo = catRes.data ?? [];
  const salida = [];
  for (const pg of pagosRes.data ?? []) {
    const fila = pg as Record<string, unknown>;
    // La llave manda; el nombre en texto es el respaldo de los pagos viejos.
    const m = fila.musico_id
      ? catalogo.find((c) => c.id === fila.musico_id)
      : catalogo.find((c) => norm(String(c.nombre)) === norm(String(fila.musico ?? "")));
    if (!m || !m.activo) continue;
    salida.push({
      id: m.id as string,
      nombre: m.nombre as string,
      // Lo que se contrató para ESTE proyecto. La columna primero; si no está,
      // se saca de la nota vieja; y de último, su primer instrumento del catálogo.
      instrumento:
        (fila.instrumento as string | null)?.trim()
        || instrumentoDe(fila.nota as string | null)
        || ((m.instrumentos as string[] | null) ?? [])[0]
        || "",
      tienePortal: Boolean(m.portal_activo),
      tieneCorreo: Boolean(String(m.email || "").trim()),
    });
  }

  return NextResponse.json({ musicos: salida });
}
