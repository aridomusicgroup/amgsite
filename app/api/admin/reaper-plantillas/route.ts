import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Qué archivo .rpp se copia para cada servicio vendido.
 *
 * Lo lee `reaper-sync/plantillas.js` al crear la carpeta de un proyecto nuevo.
 * Sin coincidencia se usa PLANTILLA.rpp y queda el aviso en la bitácora — nunca
 * se deja un proyecto sin crear por un mapa mal configurado.
 *
 * La lista de archivos disponibles sale de `reaper_disco`, que publica el script
 * local en cada corrida: el panel corre en Vercel y no puede leer X:\.
 */

const MAX = 200;

/**
 * Mismo criterio que `nombreSeguro` en reaper-sync/plantillas.js.
 *
 * Está duplicado a propósito y no importado: son dos procesos distintos (Vercel
 * y la máquina con REAPER) y el valor termina en un `path.join()` del lado del
 * script. Que cada uno valide por su cuenta es lo que hace que una fila metida
 * por SQL directo tampoco pueda salirse de la carpeta raíz.
 */
function nombreValido(archivo: string): boolean {
  if (!archivo || archivo.length > MAX || archivo.length < 5) return false;
  if (/[\\/:*?"<>|]/.test(archivo)) return false;
  if (archivo.includes("..")) return false;
  return /\.rpp$/i.test(archivo);
}

interface FilaDisco { archivo?: string }

export async function GET() {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sb = supabaseAdmin();

  const [mapaRes, discoRes] = await Promise.all([
    sb.from("reaper_plantillas").select("ambito, llave, archivo, alias, activo, nota").order("ambito").order("llave"),
    sb.from("reaper_disco").select("rpps, root, escaneado_en").eq("id", 1).maybeSingle(),
  ]);

  // La migración la corre una persona a mano: mientras no lo haga, la pantalla
  // tiene que decir "todavía no hay nada configurado", no romperse.
  if (mapaRes.error) {
    return NextResponse.json({ mapa: [], archivosDisco: [], escaneadoEn: null, root: null, sinTabla: true });
  }

  const archivosDisco = (((discoRes.data?.rpps as FilaDisco[] | null) ?? [])
    .map((r) => String(r?.archivo ?? "").trim())
    .filter(Boolean));
  const enDisco = new Set(archivosDisco.map((a) => a.toLowerCase()));

  const mapa = (mapaRes.data ?? []).map((f) => ({
    ambito: f.ambito as string,
    llave: f.llave as string,
    archivo: f.archivo as string,
    alias: (f.alias as string | null) ?? "",
    activo: f.activo !== false,
    nota: (f.nota as string | null) ?? "",
    // Se distingue "no existe" de "el script lleva rato sin correr" con la
    // fecha del escaneo, que va aparte.
    existe: enDisco.has(String(f.archivo).toLowerCase()),
  }));

  return NextResponse.json({
    mapa,
    archivosDisco,
    escaneadoEn: (discoRes.data?.escaneado_en as string | null) ?? null,
    root: (discoRes.data?.root as string | null) ?? null,
    sinTabla: false,
  });
}

/** POST: crea o actualiza el mapeo de un servicio (la llave es ámbito+llave). */
export async function POST(req: NextRequest) {
  const actor = await getFullAdminEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const ambito = String(b.ambito || "").trim();
  const llave = String(b.llave || "").trim().slice(0, MAX);
  const archivo = String(b.archivo || "").trim().slice(0, MAX);
  const alias = String(b.alias ?? "").trim().slice(0, 500) || null;
  const nota = String(b.nota ?? "").trim().slice(0, 500) || null;

  if (ambito !== "paquete" && ambito !== "tipo") {
    return NextResponse.json({ error: "Ámbito inválido." }, { status: 400 });
  }
  if (!llave) return NextResponse.json({ error: "Elige el paquete o el tipo." }, { status: 400 });
  if (!nombreValido(archivo)) {
    return NextResponse.json({ error: "El archivo tiene que ser sólo un nombre terminado en .rpp, sin carpetas." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("reaper_plantillas").upsert(
    { ambito, llave, archivo, alias, nota, activo: b.activo !== false, updated_at: new Date().toISOString(), updated_por: actor },
    { onConflict: "ambito,llave" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE: quita el mapeo — ese servicio vuelve a nacer con la plantilla general. */
export async function DELETE(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const ambito = u.get("ambito");
  const llave = u.get("llave");
  if (!ambito || !llave) return NextResponse.json({ error: "Falta el ámbito o la llave." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("reaper_plantillas").delete().eq("ambito", ambito).eq("llave", llave);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
