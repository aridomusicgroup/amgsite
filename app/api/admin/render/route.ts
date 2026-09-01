import { NextRequest, NextResponse } from "next/server";
import { getDevEmail } from "@/lib/supabase/auth-server";
import { encolarRender, TIPOS_RENDER, type TipoRender, type OpcionesRender } from "@/lib/render-jobs";

export const dynamic = "force-dynamic";

/** Tope de pistas por render: más que esto es que algo va mal, no una elección. */
const MAX_PISTAS = 200;

/**
 * Valida lo que eligió el usuario en el cuadro de opciones.
 *
 * Se revisa aunque la ruta ya esté cerrada al desarrollador: estos valores
 * terminan armando una ruta de archivo y modificando un .rpp en el disco local,
 * así que no pueden pasar tal cual desde el navegador.
 */
function leerOpciones(raw: unknown): { ok: true; op: OpcionesRender | null } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: true, op: null };
  const b = raw as Record<string, unknown>;
  const op: OpcionesRender = {};

  if (b.rpp !== undefined && b.rpp !== null) {
    const rpp = String(b.rpp).trim();
    // Un nombre de archivo suelto, nada de rutas: el script lo va a unir con la
    // carpeta del proyecto y no debe poder salirse de ahí.
    if (!rpp || rpp.length > 260 || /[\/]/.test(rpp) || rpp.includes("..") || !rpp.toLowerCase().endsWith(".rpp")) {
      return { ok: false, error: "El proyecto base elegido no es válido." };
    }
    op.rpp = rpp;
  }

  if (b.rango !== undefined && b.rango !== null) {
    const r = b.rango as Record<string, unknown>;
    const inicio = Number(r.inicio);
    const fin = Number(r.fin);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio < 0) {
      return { ok: false, error: "El rango de tiempo no es válido." };
    }
    if (fin - inicio < 1) return { ok: false, error: "El rango tiene que durar al menos un segundo." };
    op.rango = { inicio, fin };
  }

  if (b.pistas !== undefined && b.pistas !== null) {
    if (!Array.isArray(b.pistas)) return { ok: false, error: "La lista de pistas no es válida." };
    const pistas = b.pistas.map((p) => String(p).trim()).filter(Boolean);
    if (!pistas.length) return { ok: false, error: "Hay que elegir al menos una pista." };
    if (pistas.length > MAX_PISTAS) return { ok: false, error: "Demasiadas pistas." };
    op.pistas = pistas;
  }

  return { ok: true, op: Object.keys(op).length ? op : null };
}

/** Encola un render de REAPER. Solo el desarrollador — dispara trabajo en su máquina. */
export async function POST(req: NextRequest) {
  const email = await getDevEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyectoId || "").trim();
  const tareaId = b.tareaId ? String(b.tareaId).trim() : null;
  const tipo = String(b.tipo || "") as TipoRender;

  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });
  if (!TIPOS_RENDER.includes(tipo)) return NextResponse.json({ error: "Tipo de render inválido." }, { status: 400 });

  const op = leerOpciones(b.opciones);
  if (!op.ok) return NextResponse.json({ error: op.error }, { status: 400 });
  // Elegir pistas sólo tiene sentido en stems; en otro tipo sería una elección
  // silenciosamente ignorada.
  if (tipo !== "stems" && op.op?.pistas) {
    return NextResponse.json({ error: "Sólo los stems permiten elegir pistas." }, { status: 400 });
  }

  const r = await encolarRender(proyectoId, tareaId, tipo, email, op.op);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 409 });
  return NextResponse.json({ ok: true, id: r.id });
}
