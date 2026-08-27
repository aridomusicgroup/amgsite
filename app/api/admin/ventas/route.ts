import { NextRequest, NextResponse } from "next/server";
import { getFullAdminEmail } from "@/lib/supabase/auth-server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { crearTareasDeProyecto, parseInstrumentos } from "@/lib/produccion-tareas";
import { crearPedidoDeProyecto } from "@/lib/pedido-sync";
import { crearPagosMusicoPendientes } from "@/lib/musicos-sync";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";
import { seguimientoAuto } from "@/lib/seguimiento-auto";
import { esPagoDeContado } from "@/lib/fidelidad";
import { registrarPagoDeContado, revertirFidelidadDeVenta, sincronizarFidelidadVenta } from "@/lib/fidelidad-server";

const peso = (n: unknown) => `$${(Number(n) || 0).toLocaleString("es-MX")}`;

export const dynamic = "force-dynamic";

const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
const tel10 = (s: string) => String(s || "").replace(/\D/g, "").slice(-10);

// Recalcula LTV (y etapa, sin degradar) del contacto a partir de sus ventas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalcContacto(sb: any, contactoId: string | null) {
  if (!contactoId) return;
  const { data: vts } = await sb.from("ventas").select("total_mxn").eq("contacto_id", contactoId);
  const sum = (vts ?? []).reduce((a: number, v: { total_mxn: number }) => a + (Number(v.total_mxn) || 0), 0);
  const n = (vts ?? []).length;
  const patch: Record<string, unknown> = { ltv: sum, updated_at: new Date().toISOString() };
  if (n >= 1) patch.etapa = n > 1 ? "recurrente" : "cliente"; // con 0 ventas no toca la etapa
  await sb.from("contactos").update(patch).eq("id", contactoId);
}

// Registra una venta nueva desde el panel (reemplaza la captura en el sheet).
// Une o crea el contacto (cliente) y recalcula su LTV/etapa.
export async function POST(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const total = Number(b.total_mxn);
  if (!b.fecha || !(total > 0)) {
    return NextResponse.json({ error: "Faltan datos (fecha o total en MXN)." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // ── Contacto: une por email → teléfono → nombre; crea si no existe ──
  let contactoId: string | null = null;
  const cliente = (b.cliente || "").trim();
  const email = (b.email || "").trim().toLowerCase();
  const telefono = (b.telefono || "").trim();
  const t10 = tel10(telefono);
  if (cliente || email || telefono) {
    const { data: existentes } = await sb.from("contactos").select("id, nombre, email, telefono").is("merged_into", null);
    const list = existentes ?? [];
    const match =
      (email && list.find((c) => c.email && c.email.toLowerCase() === email)) ||
      (t10.length === 10 && list.find((c) => c.telefono && tel10(c.telefono) === t10)) ||
      (cliente && list.find((c) => c.nombre && norm(c.nombre) === norm(cliente))) ||
      null;
    if (match) {
      contactoId = match.id;
      // completa los datos que la ficha no tuviera (sin pisar lo bueno)
      const patch: Record<string, string> = {};
      if (email && !match.email) patch.email = email;
      if (telefono && !match.telefono) patch.telefono = telefono;
      if (Object.keys(patch).length) await sb.from("contactos").update(patch).eq("id", match.id);
    } else {
      const { data: nuevo } = await sb
        .from("contactos")
        .insert({ nombre: cliente || null, email: email || null, telefono: telefono || null, etapa: "cliente", origen: b.canal || null })
        .select("id")
        .single();
      contactoId = nuevo?.id ?? null;
    }
  }

  // ── Folio: continúa la serie I#### del sheet ──
  const { data: ult } = await sb
    .from("ventas")
    .select("folio")
    .like("folio", "I%")
    .order("folio", { ascending: false })
    .limit(1);
  let folio = "I0001";
  const prev = ult?.[0]?.folio;
  if (prev) {
    const n = parseInt(prev.replace(/\D/g, ""), 10);
    if (!isNaN(n)) folio = "I" + String(n + 1).padStart(4, "0");
  }

  const { data: ventaRow, error } = await sb.from("ventas").insert({
    folio,
    fecha: b.fecha,
    contacto_id: contactoId,
    cotizacion_id: b.cotizacion_id || null,
    tipo: b.tipo || null,
    beat_nombre: b.beat_nombre || null,
    inventario_beat_id: b.inventario_beat_id || null,
    canal: b.canal || null,
    moneda: (b.moneda || "MXN").toUpperCase(),
    monto_cobrado: Number(b.monto_cobrado) || null,
    tipo_cambio: Number(b.tipo_cambio) || null,
    total_mxn: total,
    medio_pago: b.medio_pago || null,
    costo_extra: Number(b.costo_extra) || 0,
    extras: b.extras || null,
    canciones: b.canciones || null,
    quien_cerro: b.quien_cerro || null,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Pagos a músicos EN PENDIENTE según los instrumentos de la venta + el catálogo.
  if (ventaRow?.id) await crearPagosMusicoPendientes(sb, ventaRow.id as string, b.extras);

  // Bitácora: venta registrada
  try {
    const actor = await getFullAdminEmail();
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "venta_creada",
      titulo: `${quien} registró la venta ${folio} — ${b.beat_nombre || b.tipo || "venta"} · ${peso(b.total_mxn)}${cliente ? ` (${cliente})` : ""}`,
      actor, entidad: "venta", entidad_id: ventaRow.id as string, entidad_nombre: folio,
      meta: { total_mxn: b.total_mxn, tipo: b.tipo ?? null, canal: b.canal ?? null },
    });
  } catch { /* bitácora best-effort */ }

  // ── Cotización de origen: marca aceptada y hereda el contacto si le faltaba ──
  if (b.cotizacion_id) {
    const patchCot: Record<string, unknown> = { estado: "aceptada", updated_at: new Date().toISOString() };
    if (contactoId) {
      const { data: cot } = await sb.from("cotizaciones").select("contacto_id").eq("id", b.cotizacion_id).single();
      if (cot && !cot.contacto_id) patchCot.contacto_id = contactoId;
    }
    await sb.from("cotizaciones").update(patchCot).eq("id", b.cotizacion_id);
  }

  // ── Se cerró la venta: ya no hay nada que perseguir ──
  // El siguiente recordatorio nace cuando el proyecto se entregue, no antes.
  // Esto es lo que evitaba que a un cliente que acaba de comprar le siguiéramos
  // preguntando "si sigue interesado".
  await seguimientoAuto(sb, {
    contactoId,
    accion: null,
    motivo: `se cerró la venta ${folio}`,
    actor: await getFullAdminEmail(),
  });

  // ── Anticipo: si lo dieron parcial, registra el primer pago (resto = saldo) ──
  // Sin anticipo (o anticipo ≥ total) la venta queda sin pagos = cobrada al 100%.
  const anticipo = Number(b.anticipo) || 0;
  let saldoPendiente = 0;
  if (ventaRow?.id && anticipo > 0 && anticipo < total) {
    const { error: pErr } = await sb.from("pagos").insert({
      venta_id: ventaRow.id,
      fecha: b.fecha,
      monto_mxn: anticipo,
      tipo: "anticipo",
      medio_pago: b.medio_pago || null,
    });
    // Si la tabla pagos aún no existe, no truena la venta: solo se omite el anticipo.
    if (!pErr) saldoPendiente = total - anticipo;
  }

  // ── Fidelidad: esta venta se pagó de una sola vez (sin anticipo, o el
  //    anticipo cubrió todo) → suma un escalón permanente. Las ventas de
  //    WhatsApp/Instagram no llevan descuento propio (eso solo aplica a
  //    cotizaciones "de contado"), así que no generan crédito, solo nivel.
  if (esPagoDeContado(anticipo, total)) {
    await registrarPagoDeContado(sb, contactoId, total, { ventaId: ventaRow?.id ?? null });
  }

  // ── Recalcula LTV/etapa del contacto ──
  if (contactoId) {
    const { data: vts } = await sb.from("ventas").select("total_mxn").eq("contacto_id", contactoId);
    const sum = (vts ?? []).reduce((a, v) => a + (Number(v.total_mxn) || 0), 0);
    const n = (vts ?? []).length;
    await sb.from("contactos")
      .update({ ltv: sum, etapa: n > 1 ? "recurrente" : "cliente", updated_at: new Date().toISOString() })
      .eq("id", contactoId);
  }

  // ── Proyecto de producción automático (SOLO servicios; los beats de catálogo NO) ──
  //    Toma la info de la venta y arma las tareas: grabación de cada músico/instrumento
  //    (campo "extras") + Mezcla + Masterización.
  let proyectoFolio: string | null = null;
  if (b.crear_proyecto && ventaRow?.id) {
    try {
      // Responsable: intenta casar "quién cerró" con un miembro del equipo
      let responsableId: string | null = null;
      if (b.quien_cerro && String(b.quien_cerro).trim()) {
        const { data: eq } = await sb.from("equipo").select("id").ilike("nombre", `%${String(b.quien_cerro).trim()}%`).limit(1);
        responsableId = (eq?.[0]?.id as string | undefined) ?? null;
      }
      // Folio P####
      const { data: ultP } = await sb.from("proyectos").select("folio").like("folio", "P%").order("folio", { ascending: false }).limit(1);
      let pn = 0;
      const pv = ultP?.[0]?.folio as string | undefined;
      if (pv) { const m = parseInt(pv.replace(/\D/g, ""), 10); if (!isNaN(m)) pn = m; }
      proyectoFolio = "P" + String(pn + 1).padStart(4, "0");
      // Tipo del proyecto a partir del tipo de la venta (EP/Álbum tienen prioridad)
      const tv = String(b.tipo || "");
      const canciones = String(b.canciones || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      const tproy = /álbum|album/i.test(tv) ? "album" : /\bep\b/i.test(tv) ? "ep"
        : /personaliz/i.test(tv) ? "beat_personalizado" : /letra/i.test(tv) ? "bp_letra"
        : /mezcla|master/i.test(tv) ? "mezcla_master" : /grabaci/i.test(tv) ? "grabacion"
        : /exclusiv/i.test(tv) ? "exclusividad" : "beat_personalizado";
      const { data: proy } = await sb.from("proyectos").insert({
        folio: proyectoFolio, clase: "produccion",
        titulo: b.beat_nombre || tv || "Producción", tipo: tproy, estado: "cola", prioridad: "media",
        contacto_id: contactoId, venta_id: ventaRow.id, cotizacion_id: b.cotizacion_id || null,
        responsable_id: responsableId, creado_por: "ventas",
      }).select("id").single();
      // Tareas del proyecto, en orden de prioridad:
      //  1. EP/Álbum → una tarea por canción.
      //  2. `tareas_libres` → conceptos fuera de catálogo ("+ Libre"): se crean tal
      //     cual, SIN plantilla (no aplica maqueta/mezcla/master a algo a la medida).
      //  3. Si no → mismo motor de plantillas que Producción.
      const libres = String(b.tareas_libres || "").split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
      if (proy?.id) {
        if (canciones.length) {
          const rows = canciones.map((titulo, i) => ({ proyecto_id: proy.id, titulo, responsable_id: responsableId, orden: i, es_cancion: true }));
          await sb.from("proyecto_tareas").insert(rows);
        } else if (libres.length) {
          const rows = libres.map((titulo, i) => ({ proyecto_id: proy.id, titulo, responsable_id: responsableId, orden: i }));
          await sb.from("proyecto_tareas").insert(rows);
        } else {
          // `instrumentos` viene del selector; `extras` queda como respaldo histórico.
          await crearTareasDeProyecto(sb, proy.id, tproy, parseInstrumentos(b.instrumentos || b.extras));
        }
        // Dispara el pedido del sitio ligado → el cliente ve el avance en su panel.
        try { await crearPedidoDeProyecto(sb, proy.id); } catch (e) { console.error("pedido-sync:", e); }
      }
    } catch (e) {
      console.error("Auto proyecto desde venta falló:", e);
    }
  }

  return NextResponse.json({ ok: true, folio, saldo: saldoPendiente, proyecto: proyectoFolio });
}

// ── Editar una venta (solo admin total) ──
export async function PATCH(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id de la venta." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (b.fecha) patch.fecha = b.fecha;
  for (const k of ["tipo", "beat_nombre", "canal", "medio_pago", "extras", "quien_cerro"]) {
    if (k in b) patch[k] = b[k] ? b[k] : null;
  }
  if (b.moneda) patch.moneda = String(b.moneda).toUpperCase();
  if (b.total_mxn !== undefined && b.total_mxn !== "") patch.total_mxn = Number(b.total_mxn) || 0;
  // costo_extra ya NO se edita a mano: lo mantiene la API de pagos-musico como la
  // suma itemizada (evita sobrescribir esa suma al editar otros campos de la venta).
  if (b.monto_cobrado !== undefined) patch.monto_cobrado = b.monto_cobrado === "" ? null : Number(b.monto_cobrado) || null;
  if (b.tipo_cambio !== undefined) patch.tipo_cambio = b.tipo_cambio === "" ? null : Number(b.tipo_cambio) || null;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nada que actualizar." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: updated, error } = await sb.from("ventas").update(patch).eq("id", id).select("contacto_id, folio").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Si cambió el total, puede que lo ya cobrado ahora sí (o ya no) lo cubra
  // por completo — revisa si hay que sumar o revertir fidelidad.
  if ("total_mxn" in patch) await sincronizarFidelidadVenta(sb, id);

  try {
    const actor = await getFullAdminEmail();
    const quien = await nombreDeActor(sb, actor);
    const campos = Object.keys(patch).join(", ");
    await registrarActividad(sb, {
      tipo: "venta_editada",
      titulo: `${quien} editó la venta ${updated?.folio ?? ""} (${campos})`,
      actor, entidad: "venta", entidad_id: id, entidad_nombre: (updated?.folio as string) ?? null,
      meta: patch,
    });
  } catch { /* bitácora best-effort */ }

  await recalcContacto(sb, (updated?.contacto_id as string) ?? null);
  return NextResponse.json({ ok: true });
}

// ── Eliminar una venta (solo admin total) ──
// Borra sus pagos (cascade), su comisión BeatStars si aplica, libera las
// interacciones que la referencien y recalcula el LTV del cliente.
export async function DELETE(req: NextRequest) {
  if (!(await getFullAdminEmail())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const id = String(b.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "Falta el id de la venta." }, { status: 400 });

  const sb = supabaseAdmin();
  // `fidelidad_contada` es columna nueva: si todavía no se corrió el SQL, se
  // reintenta sin ella — nunca puede tumbar el borrado de una venta, que ya
  // funcionaba antes de que existiera este campo.
  let venta: { folio: string | null; contacto_id: string | null; total_mxn?: number; fidelidad_contada?: boolean } | null = null;
  {
    const r = await sb.from("ventas").select("folio, contacto_id, total_mxn, fidelidad_contada").eq("id", id).single();
    venta = r.error ? (await sb.from("ventas").select("folio, contacto_id").eq("id", id).single()).data : r.data;
  }
  if (!venta) return NextResponse.json({ error: "Venta no encontrada." }, { status: 404 });

  // Si esta venta ya había sumado su escalón de fidelidad, bájalo ANTES de
  // borrarla — sin esto, borrar una venta contada dejaba el nivel del cliente
  // inflado para siempre.
  if (venta.fidelidad_contada) {
    await revertirFidelidadDeVenta(sb, venta.contacto_id, id, Number(venta.total_mxn) || 0);
  }

  // Libera referencias en interacciones (la FK no tiene cascade → evita el bloqueo).
  await sb.from("interacciones").update({ venta_id: null }).eq("venta_id", id);
  // Comisión asociada (egreso BSC-…) de ventas de BeatStars.
  const folio = venta.folio as string | null;
  if (folio && folio.startsWith("BS-")) await sb.from("egresos").delete().eq("folio", "BSC-" + folio.slice(3));

  const { error } = await sb.from("ventas").delete().eq("id", id); // pagos se borran por cascade
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const actor = await getFullAdminEmail();
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "venta_eliminada",
      titulo: `${quien} eliminó la venta ${venta.folio ?? ""}`,
      actor, entidad: "venta", entidad_id: id, entidad_nombre: (venta.folio as string) ?? null,
    });
  } catch { /* bitácora best-effort */ }

  await recalcContacto(sb, (venta.contacto_id as string) ?? null);
  return NextResponse.json({ ok: true });
}
