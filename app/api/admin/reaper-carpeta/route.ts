import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { carpetaPendiente, pedirRenombre, type TablaCarpeta } from "@/lib/carpeta-reaper";
import { registrarActividad } from "@/lib/actividad";

export const dynamic = "force-dynamic";

/**
 * "¿Renombrar también la carpeta de REAPER?"
 *
 * GET  → si algo ya renombrado sigue con la carpeta vieja (lo pregunta la
 *        ventana de la tarea al cerrarse, porque guarda mientras se escribe).
 * POST → "sí": deja el encargo; el script del estudio la mueve en su siguiente
 *        vuelta (reaper-sync/renombrar.js). "No" no llama a nada: la carpeta
 *        ya quedó anclada y el script la sigue encontrando.
 */

const tablaDe = (v: unknown): TablaCarpeta | null =>
  v === "contactos" || v === "proyectos" || v === "proyecto_tareas" ? v : null;

export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const tabla = tablaDe(req.nextUrl.searchParams.get("tabla"));
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!tabla || !id) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  return NextResponse.json({ carpeta: await carpetaPendiente(supabaseAdmin(), tabla, id) });
}

export async function POST(req: NextRequest) {
  const actor = await getProduccionEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const tabla = tablaDe(b.tabla);
  const id = String(b.id || "").trim();
  if (!tabla || !id) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });

  const sb = supabaseAdmin();
  if (!(await pedirRenombre(sb, tabla, id))) {
    return NextResponse.json({ error: "No se pudo pedir. ¿Ya se corrió supabase-reaper-carpeta.sql?" }, { status: 409 });
  }

  const proyectoId = tabla === "proyectos"
    ? id
    : tabla === "proyecto_tareas"
      ? ((await sb.from("proyecto_tareas").select("proyecto_id").eq("id", id).maybeSingle()).data?.proyecto_id as string | undefined) ?? null
      : null;
  await registrarActividad(sb, {
    tipo: "nombre_sincronizado",
    titulo: `Se pidió renombrar la carpeta de REAPER a “${String(b.nueva ?? "").slice(0, 120)}”`,
    actor, proyecto_id: proyectoId, tarea_id: tabla === "proyecto_tareas" ? id : null,
    meta: { tabla, carpeta: b.nueva ?? null },
  });
  return NextResponse.json({ ok: true });
}
