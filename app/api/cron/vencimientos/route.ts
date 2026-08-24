import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushAEmails } from "@/lib/push";
import { adminEmails } from "@/lib/supabase/auth-server";
import {
  FUERA_TABLERO, hoyISO, estaAtrasado, venceManana, diasTarde, armarAviso, type ItemVenc,
} from "@/lib/vencimientos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE = "https://admin.aridomusicgroup.com";

/**
 * Aviso diario de atrasos y de lo que vence mañana. SOLO push, sin correo:
 * es un empujón interno del equipo, no un documento.
 *
 * A cada quien le llega UN push con lo SUYO — los proyectos donde está en el
 * equipo y las tareas donde es el responsable. Lo que no tiene a nadie asignado
 * se va a los admins, que si no, nadie se entera de que existe.
 *
 * Sale de aquí con la salida puesta ("ponle nueva fecha"): al mover la fecha, el
 * proyecto deja de aparecer hasta que la nueva llegue. Sin esa salida el aviso
 * se repetiría idéntico cada mañana hasta que alguien apague las notificaciones.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const hoy = hoyISO();

  const [{ data: proys }, { data: tareas }, { data: eq }] = await Promise.all([
    sb.from("proyectos")
      .select("id, titulo, estado, fecha_entrega, responsable_id, responsables")
      .not("estado", "in", `(${FUERA_TABLERO.join(",")})`)
      .not("fecha_entrega", "is", null),
    sb.from("proyecto_tareas")
      .select("id, titulo, fecha, responsable_id, proyectos(titulo, estado)")
      .eq("hecho", false)
      .not("fecha", "is", null),
    sb.from("equipo").select("id, nombre, email").eq("activo", true),
  ]);

  const correoDe = new Map(
    (eq ?? []).filter((e) => e.email).map((e) => [e.id as string, String(e.email).toLowerCase()]),
  );
  // Bandejas por persona. `null` = sin dueño → se acumula para los admins.
  const atrasadosDe = new Map<string | null, ItemVenc[]>();
  const mananaDe = new Map<string | null, ItemVenc[]>();
  const meter = (m: Map<string | null, ItemVenc[]>, quien: string | null, i: ItemVenc) =>
    m.set(quien, [...(m.get(quien) ?? []), i]);

  for (const p of proys ?? []) {
    const fecha = p.fecha_entrega as string;
    const atrasado = estaAtrasado(fecha, p.estado as string, hoy);
    const manana = venceManana(fecha, p.estado as string, hoy);
    if (!atrasado && !manana) continue;

    const item: ItemVenc = {
      id: p.id as string,
      clase: "proyecto",
      titulo: p.titulo as string,
      proyecto: null,
      fecha,
      tarde: atrasado ? diasTarde(fecha, hoy) : 0,
    };
    // "Los implicados": el lead y todo el equipo del proyecto.
    const gente = [...new Set([p.responsable_id as string | null, ...((p.responsables as string[] | null) ?? [])].filter(Boolean))] as string[];
    const destinos: (string | null)[] = gente.length ? gente : [null];
    for (const g of destinos) meter(atrasado ? atrasadosDe : mananaDe, g, item);
  }

  for (const t of tareas ?? []) {
    const proyRaw = (t as { proyectos?: unknown }).proyectos;
    const proy = (Array.isArray(proyRaw) ? proyRaw[0] : proyRaw) as
      | { titulo?: string; estado?: string } | undefined;
    // Una tarea de un proyecto ya cerrado no se persigue, aunque siga sin palomear.
    if (proy?.estado && FUERA_TABLERO.includes(proy.estado)) continue;

    const fecha = t.fecha as string;
    // La tarea no tiene estado propio: se evalúa contra el de su proyecto.
    const estado = proy?.estado ?? "produccion";
    const atrasado = estaAtrasado(fecha, estado, hoy);
    const manana = venceManana(fecha, estado, hoy);
    if (!atrasado && !manana) continue;

    const item: ItemVenc = {
      id: t.id as string,
      clase: "tarea",
      titulo: t.titulo as string,
      proyecto: proy?.titulo ?? null,
      fecha,
      tarde: atrasado ? diasTarde(fecha, hoy) : 0,
    };
    meter(atrasado ? atrasadosDe : mananaDe, (t.responsable_id as string | null) ?? null, item);
  }

  // Lo huérfano lo ven los admins.
  const admins = [...new Set(adminEmails().map((e) => e.toLowerCase()))];
  const quienes = new Set<string | null>([...atrasadosDe.keys(), ...mananaDe.keys()]);
  let avisados = 0;

  for (const quien of quienes) {
    const aviso = armarAviso(atrasadosDe.get(quien) ?? [], mananaDe.get(quien) ?? []);
    if (!aviso) continue;

    const correos = quien === null ? admins : [correoDe.get(quien)].filter(Boolean) as string[];
    if (!correos.length) continue;

    // Uno solo: se abre ESE y se resalta. Varios: la lista ya filtrada.
    const url = aviso.id
      ? `${SITE}/admin/produccion?destacar=${aviso.id}`
      : `${SITE}/admin/produccion?foco=${aviso.foco}`;
    await pushAEmails(sb, correos, { titulo: aviso.titulo, cuerpo: aviso.cuerpo, url });
    avisados++;
  }

  return NextResponse.json({
    ok: true,
    personas: avisados,
    atrasados: [...atrasadosDe.values()].reduce((a, v) => a + v.length, 0),
    manana: [...mananaDe.values()].reduce((a, v) => a + v.length, 0),
  });
}
