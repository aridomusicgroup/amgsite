import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getProduccionEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombresPorId, nombreDeActor } from "@/lib/actividad";
import { pushAResponsables, contextoProyecto, conProyecto, destinoTarea } from "@/lib/push";
import { progresoTareaEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

const SITE = "https://aridomusicgroup.com";

/**
 * Al completar una tarea VISIBLE, avisa al cliente por correo con el avance.
 * Best-effort: nunca rompe el flujo del equipo. Solo si el proyecto tiene un
 * pedido ligado (order_id) y el contacto tiene correo.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notificarProgresoCliente(sb: any, proyectoId: string, tareaTitulo: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const { data: p } = await sb.from("proyectos").select("titulo, order_id, contacto_id").eq("id", proyectoId).single();
  if (!p?.order_id || !p.contacto_id) return;
  const { data: ct } = await sb.from("contactos").select("nombre, email").eq("id", p.contacto_id).single();
  const email = String(ct?.email || "").trim().toLowerCase();
  if (!email) return;

  // Avance por tareas VISIBLES del proyecto.
  const { data: ts } = await sb.from("proyecto_tareas").select("hecho").eq("proyecto_id", proyectoId).eq("visible_cliente", true);
  const total = (ts ?? []).length;
  const hechas = (ts ?? []).filter((t: { hecho: boolean }) => t.hecho).length;
  const entregado = total > 0 && hechas >= total;

  const mail = progresoTareaEmail({
    customerName: (ct?.nombre as string | null)?.split(" ")[0] ?? null,
    concepto: (p.titulo as string) || "tu producción",
    tarea: tareaTitulo,
    hechas, total, entregado,
    url: `${SITE}/cuenta/pedido/${p.order_id}`,
  });
  const resend = new Resend(key);
  await resend.emails.send({
    from: "Latino Gang Beats <acceso@aridomusicgroup.com>",
    to: email,
    subject: mail.subject,
    html: mail.html,
  });
}

/** Persiste el nuevo orden de las tareas (array de ids ya ordenado). En paralelo. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reordenarTareas(sb: any, ids: unknown) {
  const clean = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  if (!clean.length) return NextResponse.json({ error: "Orden inválido." }, { status: 400 });
  await Promise.all(clean.map((id, i) => sb.from("proyecto_tareas").update({ orden: i }).eq("id", id)));
  return NextResponse.json({ ok: true });
}

// ── Agregar una tarea a un proyecto ──
export async function POST(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const proyectoId = String(b.proyecto_id || "").trim();
  const titulo = String(b.titulo || "").trim();
  if (!proyectoId || !titulo) return NextResponse.json({ error: "Faltan datos (proyecto o título)." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: ult } = await sb.from("proyecto_tareas").select("orden").eq("proyecto_id", proyectoId).order("orden", { ascending: false }).limit(1);
  const orden = (Number(ult?.[0]?.orden) || 0) + 1;

  // Si el proyecto está en revisión, la tarea nueva pertenece a la ronda en curso.
  const { data: proy } = await sb.from("proyectos").select("estado, revision_actual").eq("id", proyectoId).single();
  const revision = proy?.estado === "revision" ? Number(proy?.revision_actual) || 0 : 0;

  const { data: ins, error } = await sb.from("proyecto_tareas").insert({
    proyecto_id: proyectoId, titulo, responsable_id: b.responsable_id || null, fecha: b.fecha || null, hecho: false, orden, revision,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bitácora: tarea agregada (con responsable si lo trae)
  try {
    const quien = await nombreDeActor(sb, await getProduccionEmail());
    let resTxt = "";
    if (b.responsable_id) {
      const nombres = await nombresPorId(sb, [b.responsable_id]);
      resTxt = ` · para ${nombres[b.responsable_id] || "—"}`;
    }
    await registrarActividad(sb, {
      tipo: "tarea_creada",
      titulo: `${quien} agregó la tarea “${titulo}”${resTxt}`,
      proyecto_id: proyectoId, tarea_id: ins?.id ?? null,
      meta: { responsable_id: b.responsable_id || null },
    });
    if (b.responsable_id) {
      const ctx = await contextoProyecto(sb, proyectoId);
      await pushAResponsables(sb, [b.responsable_id], {
        titulo: "Nueva tarea",
        cuerpo: conProyecto(ctx.titulo, `Te asignaron: ${titulo}`),
        // Al proyecto NO: a la tarea. Abre su ventana con el resplandor puesto.
        url: ins?.id ? destinoTarea(ins.id as string) : ctx.url,
      });
    }
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true });
}

// ── Marcar hecho / editar una tarea ──
export async function PATCH(req: NextRequest) {
  const email = await getProduccionEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();

  // Reordenar: el cliente manda el array completo de ids ya ordenado (optimista).
  if (Array.isArray(b.orden_ids)) {
    return reordenarTareas(sb, b.orden_ids);
  }

  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id de la tarea." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ("hecho" in b) {
    patch.hecho = Boolean(b.hecho);
    patch.completado_at = b.hecho ? new Date().toISOString() : null; // sella/limpia para medir rendimiento
  }
  if (b.titulo && String(b.titulo).trim()) patch.titulo = String(b.titulo).trim();
  if ("responsable_id" in b) patch.responsable_id = b.responsable_id || null;
  if ("notas" in b) patch.notas = b.notas ? String(b.notas) : null;
  if ("fecha" in b) patch.fecha = b.fecha || null;
  if ("link_post" in b) patch.link_post = b.link_post ? String(b.link_post) : null;
  if ("visible_cliente" in b) patch.visible_cliente = Boolean(b.visible_cliente);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  // Estado previo: para registrar SOLO asignación/completado (no el autoguardado de notas)
  const { data: prev } = await sb.from("proyecto_tareas")
    .select("titulo, responsable_id, hecho, proyecto_id, visible_cliente").eq("id", id).single();
  const { error } = await sb.from("proyecto_tareas").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Al completar la tarea padre, marca sus subtareas pendientes como hechas.
  if (patch.hecho === true) {
    await sb.from("proyecto_subtareas").update({ hecho: true }).eq("tarea_id", id).eq("hecho", false);
  }

  // Bitácora: asignación y completado/reapertura (ignora ediciones de notas)
  try {
    const tareaTitulo = (patch.titulo as string) || (prev?.titulo as string) || "tarea";
    const proyId = (prev?.proyecto_id as string) ?? null;
    let quien: string | null = null;
    if ("responsable_id" in patch && (patch.responsable_id ?? null) !== (prev?.responsable_id ?? null)) {
      quien = await nombreDeActor(sb, email);
      const nombres = await nombresPorId(sb, [patch.responsable_id as string | null]);
      const dest = patch.responsable_id ? (nombres[patch.responsable_id as string] || "—") : "nadie";
      await registrarActividad(sb, {
        tipo: "tarea_asignada",
        titulo: `${quien} asignó la tarea “${tareaTitulo}” a ${dest}`,
        actor: email, proyecto_id: proyId, tarea_id: id,
        meta: { responsable_id: patch.responsable_id ?? null },
      });
      if (patch.responsable_id) {
        const ctx = await contextoProyecto(sb, proyId);
        await pushAResponsables(sb, [patch.responsable_id as string], {
          titulo: "Tarea asignada",
          cuerpo: conProyecto(ctx.titulo, `Te asignaron: ${tareaTitulo}`),
          url: destinoTarea(id),
        });
      }
    }
    if ("hecho" in patch && Boolean(patch.hecho) !== Boolean(prev?.hecho)) {
      quien = quien ?? (await nombreDeActor(sb, email));
      await registrarActividad(sb, {
        tipo: patch.hecho ? "tarea_completada" : "tarea_reabierta",
        titulo: patch.hecho
          ? `${quien} completó la tarea “${tareaTitulo}” ✅`
          : `${quien} reabrió la tarea “${tareaTitulo}”`,
        actor: email, proyecto_id: proyId, tarea_id: id,
      });
    }
  } catch { /* bitácora best-effort */ }

  // Aviso al cliente: solo al COMPLETAR una tarea VISIBLE (no en reapertura ni internas).
  if (patch.hecho === true && !Boolean(prev?.hecho) && prev?.visible_cliente !== false && prev?.proyecto_id) {
    try { await notificarProgresoCliente(sb, prev.proyecto_id as string, (patch.titulo as string) || (prev?.titulo as string) || "una tarea"); }
    catch (e) { console.error("notify-cliente:", e); }
  }

  return NextResponse.json({ ok: true });
}

// ── Borrar una tarea ──
export async function DELETE(req: NextRequest) {
  if (!(await getProduccionEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id de la tarea." }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb.from("proyecto_tareas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
