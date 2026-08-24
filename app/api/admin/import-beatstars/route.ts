import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Parser CSV con comillas/comillas escapadas.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// ─────────────────────────────────────────────────────────────────────────────
// Importa el CSV de ventas de BeatStars → enriquece/crea CONTACTOS por email.
// (No crea ventas: el histórico de ventas BeatStars ya vive en el sheet con folio
//  I####; crearlas de nuevo duplicaría el ingreso. Esto solo conecta a los
//  compradores por su llave natural: el email.)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await getAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { csv } = await req.json().catch(() => ({ csv: "" }));
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "Falta el contenido del CSV." }, { status: 400 });
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) return NextResponse.json({ error: "El CSV viene vacío o sin filas." }, { status: 400 });

  // Detecta columnas por nombre de encabezado (flexible)
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const findCol = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const emailIdx = findCol("email", "correo", "e-mail");
  // BeatStars parte el nombre en dos columnas. Antes solo se leía la primera y
  // los contactos entraban como "Fernando" a secas.
  const firstIdx = header.findIndex((h) => h.includes("first name"));
  const lastIdx = header.findIndex((h) => h.includes("last name"));
  const nameIdx = header.findIndex((h) => (h.includes("name") || h.includes("nombre") || h.includes("buyer") || h.includes("customer")) && !h.includes("email"));
  const locIdx = findCol("location", "ubicaci", "city", "country");
  if (emailIdx < 0) {
    return NextResponse.json({ error: "No encontré una columna de email en el CSV de BeatStars." }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: existentes } = await sb.from("contactos").select("id, email, nombre, direccion").is("merged_into", null);
  const byEmail = new Map<string, { id: string; nombre: string | null; direccion: string | null }>();
  for (const c of existentes ?? []) if (c.email) byEmail.set(c.email.toLowerCase(), { id: c.id, nombre: c.nombre, direccion: c.direccion });

  const summary = { filas: 0, nuevos: 0, enriquecidos: 0, sinEmail: 0 };
  const nuevos: { nombre: string | null; email: string; direccion: string | null; etapa: string; origen: string }[] = [];
  const vistos = new Set<string>();

  /** Para comparar nombres sin pelearse con acentos ni mayúsculas. */
  const plano = (s: string) =>
    // El rango ̀-ͯ son los acentos ya sueltos por NFD. Va con
    // escapes y no con los caracteres literales: si un editor recodifica el
    // archivo, los literales se rompen y la comparacion deja de quitar acentos.
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

  /**
   * ¿El nombre del CSV completa al que ya está, sin cambiarlo?
   *
   * Solo cuando el actual es el PRINCIPIO del nuevo ("Fernando" → "Fernando
   * Chavira"). Si difieren de otro modo NO se toca: el CRM dice "Bryan De La
   * Cruz" y el CSV "Brayan De La Cruz", y ahí manda lo que el equipo ya curó,
   * no un export de BeatStars.
   */
  const completa = (actual: string | null, nuevo: string): boolean => {
    if (!actual?.trim()) return true;
    const a = plano(actual), n = plano(nuevo);
    return n.length > a.length && n.startsWith(a);
  };

  for (const r of rows.slice(1)) {
    if (!r.length || r.every((c) => !c.trim())) continue;
    summary.filas++;
    const email = (r[emailIdx] || "").trim().toLowerCase();
    if (!isEmail(email)) { summary.sinEmail++; continue; }
    const nombre =
      (firstIdx >= 0 || lastIdx >= 0
        ? [firstIdx >= 0 ? r[firstIdx] : "", lastIdx >= 0 ? r[lastIdx] : ""]
            .map((x) => (x || "").trim()).filter(Boolean).join(" ")
        : nameIdx >= 0 ? (r[nameIdx] || "").trim() : "") || null;
    const direccion = locIdx >= 0 ? (r[locIdx] || "").trim() || null : null;

    const ex = byEmail.get(email);
    if (ex) {
      const parche: Record<string, string> = {};
      if (nombre && completa(ex.nombre, nombre)) parche.nombre = nombre;
      if (direccion && !ex.direccion?.trim()) parche.direccion = direccion;
      if (Object.keys(parche).length) {
        await sb.from("contactos").update(parche).eq("id", ex.id);
        // Se apunta en el mapa para que una segunda fila del mismo correo
        // (BeatStars repite compradores) no lo cuente dos veces.
        if (parche.nombre) ex.nombre = parche.nombre;
        if (parche.direccion) ex.direccion = parche.direccion;
        summary.enriquecidos++;
      }
    } else if (!vistos.has(email)) {
      vistos.add(email);
      nuevos.push({ nombre, email, direccion, etapa: "cliente", origen: "beatstars" });
    }
  }

  if (nuevos.length) {
    const { error, count } = await sb.from("contactos").insert(nuevos, { count: "exact" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    summary.nuevos = count ?? nuevos.length;
  }

  return NextResponse.json({ ok: true, summary });
}
