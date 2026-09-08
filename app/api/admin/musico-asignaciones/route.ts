import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad } from "@/lib/actividad";
import { makeTokenMusico } from "@/lib/musico-auth";
import { asignacionMusicoEmail } from "@/lib/emails";
import { DOMAINS } from "@/lib/site";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_NOTA = 1000;

/**
 * Asignar a un músico externo la tarea que le toca grabar.
 *
 * Lo puede hacer todo el equipo de producción, no solo los admins: es una
 * decisión de trabajo, no de dinero. (El catálogo de músicos y sus pagos sí son
 * admin — ver /api/admin/musicos.)
 */

// ── GET: quién está asignado a un proyecto ──
export async function GET(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const proyectoId = new URL(req.url).searchParams.get("proyecto_id");
  if (!proyectoId) return NextResponse.json({ error: "Falta el proyecto." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("musico_asignaciones")
    .select("id, musico_id, tarea_id, instrumento, nota, estado, musicos(nombre, email)")
    .eq("proyecto_id", proyectoId)
    .order("creado_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    asignaciones: data ?? [],
    huerfanos: await previosSinPortal(proyectoId, (data ?? []).map((a) => a.musico_id as string)),
  });
}

/**
 * A quién se le mandó un previo de este proyecto y NO lo tiene en su portal.
 *
 * Es la pregunta que nadie podía contestar sin entrar a la base: mandar el
 * previo escribe en `render_jobs` y el portal lee `musico_asignaciones`, así
 * que las dos cosas se pueden desincronizar sin que nada se vea roto. El músico
 * recibe su correo, entra, y encuentra el portal vacío o con lo del proyecto
 * anterior — que es exactamente lo que le pasó a Martín con 4-6 A 9.
 *
 * Devuelve también qué instrumento proponerle, para que arreglarlo sea un clic
 * y no un formulario.
 */
async function previosSinPortal(proyectoId: string, yaAsignados: string[]) {
  try {
    const sb = supabaseAdmin();
    const { data: jobs } = await sb
      .from("render_jobs")
      .select("musico_id, tarea_id, opciones, created_at")
      .eq("proyecto_id", proyectoId)
      .eq("tipo", "musico")
      .not("musico_id", "is", null)
      .order("created_at", { ascending: false });

    // Un músico puede tener varios previos del mismo proyecto (se re-renderiza
    // con otro BPM, se corrige la tonalidad): interesa el más reciente.
    const faltantes = new Map<string, { tareaId: string | null; instrumento: string; enviadoAt: string }>();
    for (const j of jobs ?? []) {
      const id = j.musico_id as string;
      if (yaAsignados.includes(id) || faltantes.has(id)) continue;
      const op = (j.opciones ?? {}) as Record<string, unknown>;
      faltantes.set(id, {
        tareaId: (j.tarea_id as string | null) ?? null,
        instrumento: String(op.instrumento ?? "").trim(),
        enviadoAt: j.created_at as string,
      });
    }
    if (!faltantes.size) return [];

    const ids = [...faltantes.keys()];
    const [{ data: musicos }, { data: tareas }] = await Promise.all([
      sb.from("musicos").select("id, nombre, email, instrumentos, activo, portal_activo").in("id", ids),
      sb.from("proyecto_tareas").select("id, titulo").eq("proyecto_id", proyectoId),
    ]);

    // "Grabar Charchetas" → "Charchetas". Es de donde sale la sugerencia buena:
    // cruza lo que el proyecto pide con lo que ese músico toca.
    const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
    const pedidas = (tareas ?? [])
      .filter((t) => /^grabar\s+/i.test(String(t.titulo)))
      .map((t) => ({ id: t.id as string, inst: String(t.titulo).replace(/^grabar\s+/i, "").trim() }))
      .filter((t) => t.inst);

    return (musicos ?? []).map((m) => {
      const f = faltantes.get(m.id as string)!;
      const suyos = (m.instrumentos as string[] | null) ?? [];
      const cruce = pedidas.find((p) => suyos.some((s) => norm(s) === norm(p.inst)));
      return {
        musicoId: m.id as string,
        nombre: (m.nombre as string) ?? "",
        tieneCorreo: Boolean(String(m.email ?? "").trim()),
        // Sin portal prendido, asignarle es escribir una fila que no va a ver.
        portalActivo: Boolean(m.activo) && Boolean(m.portal_activo),
        enviadoAt: f.enviadoAt,
        // Prioridad: lo que se eligió al mandar el previo → el cruce con las
        // tareas del proyecto → su primer instrumento del catálogo.
        tareaId: f.tareaId ?? cruce?.id ?? null,
        instrumento: f.instrumento || cruce?.inst || suyos[0] || "",
      };
    });
  } catch {
    // Es información de más: si falla, la lista de asignados sigue sirviendo.
    return [];
  }
}

// ── POST: asignar (y opcionalmente mandarle el enlace) ──
export async function POST(req: NextRequest) {
  const actor = await getProduccionEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const musicoId = String(b.musico_id || "").trim();
  const proyectoId = String(b.proyecto_id || "").trim();
  const tareaId = b.tarea_id ? String(b.tarea_id).trim() : null;
  const instrumento = String(b.instrumento || "").trim();
  const nota = String(b.nota || "").trim().slice(0, MAX_NOTA) || null;
  const avisar = b.avisar !== false;

  if (!musicoId || !proyectoId) return NextResponse.json({ error: "Falta el músico o el proyecto." }, { status: 400 });
  if (!instrumento) return NextResponse.json({ error: "Dile qué instrumento va a grabar." }, { status: 400 });

  const sb = supabaseAdmin();

  // Sin portal no hay a dónde mandarlo: se dice aquí y no cuando el correo
  // rebote, para que quien asigna se entere en el momento.
  const { data: m } = await sb.from("musicos")
    .select("nombre, email, portal_activo, activo")
    .eq("id", musicoId).maybeSingle();
  if (!m) return NextResponse.json({ error: "Ese músico ya no existe." }, { status: 409 });
  if (!m.activo || !m.portal_activo) {
    return NextResponse.json({ error: `${m.nombre} no tiene el portal prendido. Actívaselo en Ajustes → Músicos.` }, { status: 409 });
  }
  if (avisar && !String(m.email || "").trim()) {
    return NextResponse.json({ error: `${m.nombre} no tiene correo registrado. Agrégaselo en Ajustes → Músicos.` }, { status: 409 });
  }

  const { data: creada, error } = await sb.from("musico_asignaciones")
    .insert({ musico_id: musicoId, proyecto_id: proyectoId, tarea_id: tareaId, instrumento, nota, creado_por: actor })
    .select("id")
    .single();
  if (error) {
    // El índice único (musico_id, tarea_id) evita asignar dos veces lo mismo.
    const dup = /duplicate key|unique/i.test(error.message);
    return NextResponse.json(
      { error: dup ? `${m.nombre} ya está asignado a esa tarea.` : error.message },
      { status: dup ? 409 : 500 },
    );
  }

  const { data: proy } = await sb.from("proyectos").select("titulo").eq("id", proyectoId).maybeSingle();

  await registrarActividad(sb, {
    tipo: "musico_asignado",
    titulo: `${m.nombre} va a grabar ${instrumento}`,
    actor,
    proyecto_id: proyectoId,
    tarea_id: tareaId,
    meta: { musico: m.nombre, instrumento },
  });

  let avisado: string | null = null;
  if (avisar) {
    // Dominio FIJO, nunca el header Origin: este enlace ES la llave del portal,
    // y tomarlo de una cabecera que el que llama controla permitiría desviarlo.
    const enlace = `${DOMAINS.main}/musico/entrar?token=${makeTokenMusico(musicoId, 60 * 24 * 7)}`;
    avisado = await enviar(String(m.email), {
      nombre: String(m.nombre),
      cancion: (proy?.titulo as string) ?? "una producción",
      instrumento,
      nota,
      enlace,
    });
  }

  return NextResponse.json({ ok: true, id: creada.id, avisado });
}

// ── DELETE: quitar la asignación ──
export async function DELETE(req: NextRequest) {
  const actor = await getProduccionEmail();
  if (!actor) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("musico_asignaciones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Manda el correo. Nunca lanza: la asignación ya se guardó y vale por sí sola. */
async function enviar(correo: string, d: {
  nombre: string; cancion: string; instrumento: string; nota: string | null; enlace: string;
}): Promise<string | null> {
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    const { subject, html } = asignacionMusicoEmail(d);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Latino Gang Beats <acceso@aridomusicgroup.com>",
        to: [correo],
        subject,
        html,
      }),
    });
    return r.ok ? correo : null;
  } catch {
    return null;
  }
}
