import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushAEmails } from "@/lib/push";
import { FUERA_TABLERO, hoyISO } from "@/lib/vencimientos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE = "https://admin.aridomusicgroup.com";

/**
 * Domingo 6 pm: "agenda tu semana".
 *
 * Va a TODO el equipo activo, no solo a quien tiene algo pendiente — el punto
 * es sentarse a planear, y quien no tiene nada agendado es justamente el que
 * más necesita el empujón.
 *
 * El aviso trae el dato que duele: cuántas de sus tareas abiertas NO tienen
 * fecha. Hoy son 33 de 37 en todo el panel, y sin fecha ninguna puede avisar
 * que se venció. "Ponle fecha a tus tareas" en abstracto no mueve a nadie;
 * "tienes 6 tareas sin fecha" sí.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const hoy = hoyISO();

  const [{ data: eq }, { data: tareas }, { data: proys }] = await Promise.all([
    sb.from("equipo").select("id, nombre, email").eq("activo", true),
    sb.from("proyecto_tareas")
      .select("responsable_id, fecha, proyectos(estado)")
      .eq("hecho", false),
    sb.from("proyectos")
      .select("responsable_id, responsables, fecha_entrega, estado")
      .not("estado", "in", `(${FUERA_TABLERO.join(",")})`),
  ]);

  // Tareas abiertas sin fecha, por persona (las de proyectos ya cerrados no cuentan).
  const sinFecha = new Map<string, number>();
  for (const t of tareas ?? []) {
    const proyRaw = (t as { proyectos?: unknown }).proyectos;
    const proy = (Array.isArray(proyRaw) ? proyRaw[0] : proyRaw) as { estado?: string } | undefined;
    if (proy?.estado && FUERA_TABLERO.includes(proy.estado)) continue;
    if (t.fecha) continue;
    const r = t.responsable_id as string | null;
    if (!r) continue;
    sinFecha.set(r, (sinFecha.get(r) ?? 0) + 1);
  }

  // Proyectos abiertos en los que anda cada quien, y cuántos sin fecha de entrega.
  const proyectosDe = new Map<string, number>();
  const proyectosSinFecha = new Map<string, number>();
  for (const p of proys ?? []) {
    const gente = [...new Set([p.responsable_id as string | null, ...((p.responsables as string[] | null) ?? [])].filter(Boolean))] as string[];
    for (const g of gente) {
      proyectosDe.set(g, (proyectosDe.get(g) ?? 0) + 1);
      if (!p.fecha_entrega) proyectosSinFecha.set(g, (proyectosSinFecha.get(g) ?? 0) + 1);
    }
  }

  let avisados = 0;
  for (const p of eq ?? []) {
    const email = p.email ? String(p.email) : null;
    if (!email) continue;

    const id = p.id as string;
    const nSinFecha = sinFecha.get(id) ?? 0;
    const nProy = proyectosDe.get(id) ?? 0;
    const nProySinFecha = proyectosSinFecha.get(id) ?? 0;

    const pendientes = nSinFecha + nProySinFecha;
    const cuerpo = pendientes
      ? `Tienes ${pendientes} sin fecha — ponles día y la semana se agenda sola. 🌵`
      : nProy
        ? `Traes ${nProy} ${nProy === 1 ? "proyecto" : "proyectos"} en curso. Revísalos y ajusta fechas si hace falta. 🌵`
        : "Aprovecha para dejar armada la semana antes del lunes. 🌵";

    await pushAEmails(sb, [email], {
      titulo: "🗓️ Agenda tu semana",
      cuerpo,
      // Sin filtro de responsable: el domingo se ve TODO lo propio, no una vista recortada.
      url: `${SITE}/admin/produccion`,
    });
    avisados++;
  }

  return NextResponse.json({ ok: true, avisados, hoy });
}
