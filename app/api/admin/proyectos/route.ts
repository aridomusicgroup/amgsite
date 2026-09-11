import { NextRequest, NextResponse } from "next/server";
import { getProduccionEmail, getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { registrarActividad, nombresPorId, nombreDeActor } from "@/lib/actividad";
import { pushAResponsables } from "@/lib/push";
import { efectosDeCambioDeEstado } from "@/lib/proyecto-estado";
import { propagarNombre } from "@/lib/nombre-sync";
import { anclarCarpeta } from "@/lib/carpeta-reaper";
import { crearTareasDeProyecto, crearTareasDeCanciones, parseInstrumentos } from "@/lib/produccion-tareas";
import { crearPedidoDeProyecto } from "@/lib/pedido-sync";
import { papeleraCarpeta } from "@/lib/drive-oauth";

export const dynamic = "force-dynamic";

const ESTADO_LABEL: Record<string, string> = {
  cola: "Cola", produccion: "Producción", revision: "Revisión", entregado: "Entregado",
  cerrado: "Cerrado", pausado: "Pausado", cancelado: "Cancelado",
};

const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
const tel10 = (s: string) => String(s || "").replace(/\D/g, "").slice(-10);
const hoy = () => new Date().toISOString().slice(0, 10);

const ESTADOS = ["cola", "produccion", "revision", "entregado", "cerrado", "pausado", "cancelado"];
const TIPO_LABEL: Record<string, string> = {
  beat_personalizado: "Beat personalizado", bp_letra: "BP + Letra", grabacion: "Grabación",
  mezcla_master: "Mezcla / Master", exclusividad: "Exclusividad", ep: "EP", album: "Álbum",
};
// Tareas que dispara cada producción (caen a Tozi)
const DISTRIBUCION = ["Subir a BeatStars", "Portada de YouTube", "Portada de BeatStars", "Subir archivos a Drive", "Actualizar catálogo"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nextFolio(sb: any, table: string, prefix: string): Promise<string> {
  const { data } = await sb.from(table).select("folio").like("folio", prefix + "%").order("folio", { ascending: false }).limit(1);
  let n = 0;
  const prev = data?.[0]?.folio as string | undefined;
  if (prev) { const m = parseInt(prev.replace(/\D/g, ""), 10); if (!isNaN(m)) n = m; }
  return prefix + String(n + 1).padStart(4, "0");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalcContacto(sb: any, contactoId: string | null) {
  if (!contactoId) return;
  const { data: vts } = await sb.from("ventas").select("total_mxn").eq("contacto_id", contactoId);
  const sum = (vts ?? []).reduce((a: number, v: { total_mxn: number }) => a + (Number(v.total_mxn) || 0), 0);
  const n = (vts ?? []).length;
  const patch: Record<string, unknown> = { ltv: sum, updated_at: new Date().toISOString() };
  if (n >= 1) patch.etapa = n > 1 ? "recurrente" : "cliente";
  await sb.from("contactos").update(patch).eq("id", contactoId);
}

// ── Crear proyecto (producción o tarea interna). Acceso: equipo de producción ──
export async function POST(req: NextRequest) {
  const email = await getProduccionEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!b.titulo || !String(b.titulo).trim()) return NextResponse.json({ error: "Falta el título." }, { status: 400 });
  const clase = b.clase === "interna" ? "interna" : "produccion";

  const sb = supabaseAdmin();
  let contactoId: string | null = null;
  let ventaId: string | null = null;

  if (clase === "produccion") {
    // Contacto (une por email → teléfono → nombre, o crea)
    const cliente = (b.cliente || "").trim();
    const em = (b.email || "").trim().toLowerCase();
    const tel = (b.telefono || "").trim();
    const t10 = tel10(tel);
    if (cliente || em || tel) {
      const { data: ex } = await sb.from("contactos").select("id, nombre, email, telefono").is("merged_into", null);
      const list = ex ?? [];
      const match =
        (em && list.find((c: { email: string | null }) => c.email && c.email.toLowerCase() === em)) ||
        (t10.length === 10 && list.find((c: { telefono: string | null }) => c.telefono && tel10(c.telefono) === t10)) ||
        (cliente && list.find((c: { nombre: string | null }) => c.nombre && norm(c.nombre) === norm(cliente))) ||
        null;
      if (match) {
        contactoId = match.id;
        const patch: Record<string, string> = {};
        if (em && !match.email) patch.email = em;
        if (tel && !match.telefono) patch.telefono = tel;
        if (Object.keys(patch).length) await sb.from("contactos").update(patch).eq("id", match.id);
      } else {
        const { data: nuevo } = await sb.from("contactos")
          .insert({ nombre: cliente || null, email: em || null, telefono: tel || null, etapa: "cliente", origen: b.canal || null })
          .select("id").single();
        contactoId = nuevo?.id ?? null;
      }
    }

    // Venta + anticipo (opcional, unido al proyecto)
    const total = Number(b.total_mxn) || 0;
    if (b.crear_venta && total > 0) {
      const folioV = await nextFolio(sb, "ventas", "I");
      const { data: vr } = await sb.from("ventas").insert({
        folio: folioV, fecha: b.fecha || hoy(), contacto_id: contactoId,
        tipo: TIPO_LABEL[b.tipo] || "Beat personalizado", beat_nombre: String(b.titulo).trim(),
        canal: b.canal || "whatsapp", moneda: "MXN", total_mxn: total,
        medio_pago: b.medio_pago || null, quien_cerro: b.quien_cerro || null,
      }).select("id").single();
      ventaId = vr?.id ?? null;
      const anticipo = Number(b.anticipo) || 0;
      if (ventaId && anticipo > 0 && anticipo < total) {
        await sb.from("pagos").insert({ venta_id: ventaId, fecha: b.fecha || hoy(), monto_mxn: anticipo, tipo: "anticipo", medio_pago: b.medio_pago || null });
      }
      await recalcContacto(sb, contactoId);
    }
  }

  const responsables: string[] = Array.isArray(b.responsables) ? b.responsables.filter((x: unknown) => typeof x === "string") : [];
  const leadResp = responsables[0] || b.responsable_id || null;

  const folio = await nextFolio(sb, "proyectos", "P");
  const { data: proy, error } = await sb.from("proyectos").insert({
    folio, clase, titulo: String(b.titulo).trim(), tipo: b.tipo || null,
    estado: ESTADOS.includes(b.estado) ? b.estado : "cola",
    prioridad: ["baja", "media", "alta"].includes(b.prioridad) ? b.prioridad : "media",
    contacto_id: contactoId, venta_id: ventaId, responsable_id: leadResp, responsables: responsables.length ? responsables : null,
    fecha_inicio: b.fecha_inicio || null, fecha_entrega: b.fecha_entrega || null,
    brief: b.brief || null, notas: b.notas || null, entregable_url: b.entregable_url || null,
    tonalidad: (b.tonalidad || "").trim() || null, bpm: Number(b.bpm) || null,
    plataforma: b.plataforma || null, fecha_publicacion: b.fecha_publicacion || null, link_post: b.link_post || null,
    creado_por: email,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Canciones (EP/Album): una tarea por tema con sus pasos como subtareas.
  // El mismo motor que Ventas y que la cotizacion pagada por Stripe.
  if (proy?.id && b.canciones) {
    const canciones = String(b.canciones).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    await crearTareasDeCanciones(sb, proy.id, b.tipo, canciones, parseInstrumentos(b.instrumentos), leadResp);
  }

  // Plantilla de tareas por tipo (precargadas con responsable + subtareas)
  if (proy?.id && !b.canciones) {
    await crearTareasDeProyecto(sb, proy.id, b.tipo, parseInstrumentos(b.instrumentos));
  }

  // Checklist de distribución (a Tozi) para producciones
  if (clase === "produccion" && b.con_distribucion && proy?.id) {
    const { data: tozi } = await sb.from("equipo").select("id").or("nombre.ilike.%tozi%,nombre.ilike.%cervantes%").limit(1);
    const toziId = (tozi?.[0]?.id as string | undefined) ?? null;
    const rows = DISTRIBUCION.map((titulo, i) => ({ proyecto_id: proy.id, titulo, responsable_id: toziId, orden: i, visible_cliente: false }));
    await sb.from("proyecto_tareas").insert(rows);
  }

  // Dispara el pedido del sitio ligado (lo ve el cliente en su panel con avance en vivo).
  if (clase === "produccion" && proy?.id) {
    try { await crearPedidoDeProyecto(sb, proy.id); } catch (e) { console.error("pedido-sync:", e); }
  }

  // Bitácora: proyecto creado (con responsables involucrados)
  try {
    const quien = await nombreDeActor(sb, email);
    const nombres = await nombresPorId(sb, responsables);
    const resTxt = responsables.length
      ? ` · Responsables: ${responsables.map((r) => nombres[r] || "—").join(", ")}`
      : "";
    await registrarActividad(sb, {
      tipo: "proyecto_creado",
      titulo: `${quien} creó el proyecto “${String(b.titulo).trim()}” (${folio})${resTxt}`,
      actor: email,
      proyecto_id: proy?.id ?? null,
      meta: { folio, tipo: b.tipo ?? null, responsables },
    });
    // Push a los responsables asignados
    if (responsables.length) {
      await pushAResponsables(sb, responsables, {
        titulo: "Nuevo proyecto asignado",
        cuerpo: `${quien} te asignó “${String(b.titulo).trim()}”`,
        url: `https://admin.aridomusicgroup.com/admin/produccion?buscar=${encodeURIComponent(folio)}`,
      });
    }
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, folio });
}

// ── Editar / mover de etapa (acceso: equipo de producción) ──
export async function PATCH(req: NextRequest) {
  const email = await getProduccionEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del proyecto." }, { status: 400 });

  // Acción "Nueva ronda de revisión": sube el contador y deja el proyecto en
  // revisión. Las tareas que se creen después quedan marcadas con esta ronda.
  if (b.nueva_ronda === true) {
    const sb = supabaseAdmin();
    const { data: cur } = await sb.from("proyectos").select("titulo, revision_actual").eq("id", id).single();
    const ronda = (Number(cur?.revision_actual) || 0) + 1;
    const { error } = await sb
      .from("proyectos")
      .update({ revision_actual: ronda, estado: "revision", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    try {
      const quien = await nombreDeActor(sb, email);
      await registrarActividad(sb, {
        tipo: "proyecto_estado",
        titulo: `${quien} abrió la ronda de revisión ${ronda} en “${cur?.titulo ?? ""}”`,
        actor: email, proyecto_id: id, meta: { revision: ronda },
      });
    } catch { /* bitácora best-effort */ }
    return NextResponse.json({ ok: true, revision_actual: ronda });
  }

  const patch: Record<string, unknown> = {};
  if (b.titulo && String(b.titulo).trim()) patch.titulo = String(b.titulo).trim();
  if (b.clase === "produccion" || b.clase === "interna") patch.clase = b.clase;
  for (const k of ["tipo", "brief", "notas", "entregable_url", "responsable_id", "venta_id", "fecha_inicio", "fecha_entrega", "fecha_entrega_real", "plataforma", "fecha_publicacion", "link_post", "tonalidad", "bpm"]) {
    if (k in b) patch[k] = b[k] ? b[k] : null;
  }
  if (b.estado && ESTADOS.includes(b.estado)) patch.estado = b.estado;
  if (["baja", "media", "alta"].includes(b.prioridad)) patch.prioridad = b.prioridad;
  if ("responsables" in b) {
    const arr = Array.isArray(b.responsables) ? b.responsables.filter((x: unknown) => typeof x === "string") : [];
    patch.responsables = arr.length ? arr : null;
    patch.responsable_id = arr[0] || null; // el "lead" para filtros/rendimiento
  }
  // Override manual del límite de almacenamiento — null limpia (vuelve a usar el default de su tipo).
  if ("limite_almacenamiento_mb" in b) {
    const n = Number(b.limite_almacenamiento_mb);
    patch.limite_almacenamiento_mb = n > 0 ? n : null;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });
  // Al marcar entregado/cerrado, sella la fecha de entrega real si no la tiene
  if ((patch.estado === "entregado" || patch.estado === "cerrado") && !("fecha_entrega_real" in patch)) patch.fecha_entrega_real = hoy();
  patch.updated_at = new Date().toISOString();

  const sb = supabaseAdmin();
  const { data: prev } = await sb.from("proyectos").select("titulo, estado, responsables").eq("id", id).single();
  const renombrado = Boolean(patch.titulo && String(patch.titulo).trim() !== String(prev?.titulo ?? "").trim());
  // Antes de guardar el título nuevo: anclar su carpeta de REAPER al nombre de
  // siempre, para que el script del estudio no la pierda (ver carpeta-reaper.ts).
  const carpeta = renombrado ? await anclarCarpeta(sb, "proyectos", id, prev?.titulo as string, patch.titulo as string) : null;
  let { error } = await sb.from("proyectos").update(patch).eq("id", id);
  if (error && "limite_almacenamiento_mb" in patch) {
    // Probablemente falta la columna (SQL de almacenamiento sin correr) — reintenta sin ella.
    const { limite_almacenamiento_mb: _omit, ...sinLimite } = patch;
    ({ error } = await sb.from("proyectos").update(sinLimite).eq("id", id));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Contrato en borrador, seguimiento de conformidad y estado del pedido del
  // cliente. Vive en lib/proyecto-estado.ts porque la entrega automática
  // también mueve proyectos a Entregado, y tienen que pasar las mismas cosas.
  if (patch.estado) await efectosDeCambioDeEstado(sb, id, patch.estado as string, prev?.estado as string | undefined, email);

  // Renombrarlo aquí lo renombra en la venta y el pedido ligados. Sólo si el
  // nombre CAMBIÓ: el formulario manda el título en cada guardado.
  const sincronizado = renombrado ? (await propagarNombre(sb, "proyecto", id, patch.titulo as string, email)).en : [];

  // Bitácora: cambio de etapa y/o de responsables (solo si de verdad cambiaron)
  try {
    const tituloProy = (patch.titulo as string) || (prev?.titulo as string) || "proyecto";
    let quien: string | null = null;
    if (patch.estado && patch.estado !== prev?.estado) {
      quien = quien ?? (await nombreDeActor(sb, email));
      await registrarActividad(sb, {
        tipo: "proyecto_estado",
        titulo: `${quien} movió “${tituloProy}” a ${ESTADO_LABEL[patch.estado as string] || patch.estado}`,
        actor: email, proyecto_id: id, meta: { de: prev?.estado, a: patch.estado },
      });
    }
    if ("responsables" in b) {
      const arr = (patch.responsables as string[] | null) ?? [];
      const prevArr = (prev?.responsables as string[] | null) ?? [];
      const cambio = arr.length !== prevArr.length || arr.some((x) => !prevArr.includes(x));
      if (cambio) {
        quien = quien ?? (await nombreDeActor(sb, email));
        const nombres = await nombresPorId(sb, arr);
        const txt = arr.length ? arr.map((r) => nombres[r] || "—").join(", ") : "nadie";
        await registrarActividad(sb, {
          tipo: "proyecto_responsables",
          titulo: `${quien} asignó “${tituloProy}” a ${txt}`,
          actor: email, proyecto_id: id, meta: { responsables: arr },
        });
        // Push solo a los responsables NUEVOS (no a los que ya estaban)
        const nuevos = arr.filter((x) => !prevArr.includes(x));
        if (nuevos.length) {
          await pushAResponsables(sb, nuevos, {
            titulo: "Proyecto asignado",
            cuerpo: `${quien} te asignó “${tituloProy}”`,
          });
        }
      }
    }
  } catch { /* bitácora best-effort */ }

  return NextResponse.json({ ok: true, sincronizado, carpeta });
}

// ── Eliminar proyecto (SOLO admin total) ── tareas/subtareas/recordatorios/
// renders se borran por cascade en la BD. Venta+pagos, contrato y Drive son
// opcionales — el que llama (el diálogo de confirmación) decide cuáles, porque
// son dinero, un documento legal o archivos: nunca se borran solo por inercia.
export async function DELETE(req: NextRequest) {
  const email = await getFullAdminEmail();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id del proyecto." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: proy } = await sb.from("proyectos").select("titulo, folio, venta_id, drive_folder_id").eq("id", id).single();
  if (!proy) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404 });

  if (b.eliminarDrive && proy.drive_folder_id) {
    try { await papeleraCarpeta(proy.drive_folder_id as string); } catch { /* best-effort: no bloquea el borrado del proyecto */ }
  }
  if (b.eliminarContrato) {
    const { error: errContrato } = await sb.from("contratos").delete().eq("proyecto_id", id);
    if (errContrato) return NextResponse.json({ error: `No se pudo borrar el contrato: ${errContrato.message}` }, { status: 500 });
  }
  if (b.eliminarVenta && proy.venta_id) {
    // La FK de interacciones a ventas NO tiene cascade (mismo caso que el borrado
    // normal de una venta en /api/admin/ventas) — sin esto, el delete de abajo
    // fallaría por violación de FK y el catch silencioso lo dejaría pasar como
    // si sí hubiera borrado la venta (bitácora mintiendo, proyecto ya borrado).
    await sb.from("interacciones").update({ venta_id: null }).eq("venta_id", proy.venta_id);
    // pagos_musico SÍ tiene cascade sobre venta_id — borrar la venta se lleva
    // también los pagos a músicos de esa venta (costo, no solo el anticipo/saldo).
    const { error: errVenta } = await sb.from("ventas").delete().eq("id", proy.venta_id); // pagos y pagos_musico se borran por cascade
    if (errVenta) return NextResponse.json({ error: `No se pudo borrar la venta: ${errVenta.message}` }, { status: 500 });
  }

  const { error } = await sb.from("proyectos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await registrarActividad(sb, {
      tipo: "proyecto_estado",
      titulo: `${await nombreDeActor(sb, email)} eliminó el proyecto "${proy.titulo}" (${proy.folio ?? "sin folio"})`,
      actor: email,
      entidad_nombre: `${proy.folio ?? ""} ${proy.titulo}`.trim(),
      meta: { eliminarVenta: !!b.eliminarVenta, eliminarContrato: !!b.eliminarContrato, eliminarDrive: !!b.eliminarDrive },
    });
  } catch { /* bitácora best-effort, y ya se confirmó que el borrado sí ocurrió */ }

  return NextResponse.json({ ok: true });
}
