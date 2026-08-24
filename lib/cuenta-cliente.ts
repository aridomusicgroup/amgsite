import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Capa de datos del panel de CLIENTE (/cuenta): elegibilidad de acceso,
 * credenciales (contraseña), perfil que alimenta el CRM (`contactos`) y
 * contratos propios. Todo por correo, aislado del admin.
 */

/**
 * Correos que son la MISMA cuenta de cliente: el correo dado + su principal (si
 * es un alias) + todos los alias de ese principal. Los liga el admin en Clientes
 * (tabla `cliente_alias`). Así dos correos ven los mismos pedidos y contratos.
 */
export async function emailsDeCliente(email: string): Promise<string[]> {
  const clean = email.trim().toLowerCase();
  if (!clean) return [];
  const sb = supabaseAdmin();
  try {
    const { data: aliasRow } = await sb
      .from("cliente_alias").select("principal_email").eq("alias_email", clean).maybeSingle();
    const principal = ((aliasRow?.principal_email as string | null) || clean).toLowerCase();
    const { data: aliases } = await sb.from("cliente_alias").select("alias_email").eq("principal_email", principal);
    const set = new Set<string>([clean, principal]);
    for (const a of aliases ?? []) { const e = String(a.alias_email || "").toLowerCase(); if (e) set.add(e); }
    return [...set];
  } catch {
    return [clean];
  }
}

/** Un correo puede acceder si él (o un correo ligado) tiene ≥1 compra O contrato. */
export async function clienteElegible(email: string): Promise<boolean> {
  const emails = await emailsDeCliente(email);
  if (!emails.length) return false;
  const sb = supabaseAdmin();
  try {
    const { data: cust } = await sb.from("customers").select("id, orders(id)").in("email", emails);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of cust ?? []) if ((c.orders as any[])?.length) return true;
  } catch { /* sin tienda */ }
  try {
    const { data: ctr } = await sb.from("contratos").select("id").in("cliente_email", emails).limit(1);
    if (ctr && ctr.length) return true;
  } catch { /* sin contratos */ }
  return false;
}

/** Hash de contraseña guardado para un correo, o null si aún no tiene. */
export async function getCredencial(email: string): Promise<string | null> {
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.from("cliente_credenciales").select("password_hash").eq("email", email.trim().toLowerCase()).maybeSingle();
    return (data?.password_hash as string | null) ?? null;
  } catch {
    return null;
  }
}

/** Crea o actualiza la contraseña (hash) de un correo. */
export async function setCredencial(email: string, passwordHash: string): Promise<void> {
  const sb = supabaseAdmin();
  await sb.from("cliente_credenciales").upsert(
    { email: email.trim().toLowerCase(), password_hash: passwordHash, updated_at: new Date().toISOString() },
    { onConflict: "email" }
  );
}

export interface ClienteProfile {
  contactoId: string | null;
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  completo: boolean;
}

/** Perfil del cliente desde `contactos` (resuelve merged_into). */
export async function getClienteProfile(email: string): Promise<ClienteProfile> {
  const clean = email.trim().toLowerCase();
  const vacio: ClienteProfile = { contactoId: null, nombre: null, telefono: null, direccion: null, completo: false };
  try {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("contactos")
      .select("id, nombre, telefono, direccion, merged_into")
      .eq("email", clean)
      .limit(1)
      .maybeSingle();
    if (!data) return vacio;
    // Si la ficha está fusionada, sigue al contacto bueno.
    let row = data;
    if (data.merged_into) {
      const { data: target } = await sb.from("contactos").select("id, nombre, telefono, direccion").eq("id", data.merged_into).maybeSingle();
      if (target) row = { ...target, merged_into: null };
    }
    const nombre = (row.nombre as string | null) ?? null;
    const telefono = (row.telefono as string | null) ?? null;
    const direccion = (row.direccion as string | null) ?? null;
    return {
      contactoId: (row.id as string) ?? null,
      nombre, telefono, direccion,
      completo: Boolean(nombre && direccion),
    };
  } catch {
    return vacio;
  }
}

/** Guarda el perfil del cliente en `contactos` (por correo). Crea la ficha si no existe. */
export async function upsertClienteProfile(
  email: string,
  patch: { nombre?: string | null; telefono?: string | null; direccion?: string | null }
): Promise<void> {
  const clean = email.trim().toLowerCase();
  const sb = supabaseAdmin();
  const prof = await getClienteProfile(clean);
  const campos: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.nombre !== undefined) campos.nombre = patch.nombre?.trim() || null;
  if (patch.telefono !== undefined) campos.telefono = patch.telefono?.trim() || null;
  if (patch.direccion !== undefined) campos.direccion = patch.direccion?.trim() || null;

  if (prof.contactoId) {
    await sb.from("contactos").update(campos).eq("id", prof.contactoId);
  } else {
    await sb.from("contactos").insert({ email: clean, etapa: "cliente", origen: "sitio", ...campos });
  }
}

export interface ClienteContrato {
  id: string;
  folio: string;
  concepto: string | null;
  estado: string;
  fecha: string;
}

export interface PedidoTarea {
  id: string;
  titulo: string;
  hecho: boolean;
  completadoAt: string | null;
  /** Ronda de revisión de esta tarea: 0 = producción; 1+ = cambio de esa ronda. */
  revision: number;
  /** Pasos internos completados / totales. 0/0 = la tarea no tiene desglose. */
  subHechas: number;
  subTotal: number;
}
export interface PedidoDetalle {
  orderId: string;
  concepto: string;
  status: string;
  tipo: "beat" | "servicio";
  fecha: string;
  proyectoEstado: string | null;
  entregableUrl: string | null;
  /** Ronda de revisión en curso del proyecto (0 = sin revisiones). */
  revisionActual: number;
  /** EP o Álbum: cada tarea es una canción, no una etapa. Cambia el lenguaje. */
  esAlbum: boolean;
  tareas: PedidoTarea[];
  hechas: number;
  total: number;
  pct: number;
}

export interface ProyectoDePedido {
  proyectoId: string;
  contactoId: string | null;
  folio: string | null;
  titulo: string | null;
  tipo: string | null;
  limiteAlmacenamientoMb: number | null;
}

/**
 * El proyecto ligado a un pedido, SOLO si el pedido es de este correo (o un
 * alias suyo) — la misma verificación de dueño que `getPedidoDetalle`, pero
 * sin cargar tareas/avance (lo necesita la subida de archivos, que no pinta
 * el pipeline). Devuelve null si el pedido no es suyo o no tiene proyecto.
 */
export async function proyectoDelPedido(email: string, orderId: string): Promise<ProyectoDePedido | null> {
  const clean = email.trim().toLowerCase();
  const sb = supabaseAdmin();
  try {
    const { data: o } = await sb
      .from("orders")
      .select("id, customers(email)")
      .eq("id", orderId)
      .maybeSingle();
    if (!o) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ownerEmail = ((o.customers as any)?.email as string | null)?.toLowerCase();
    const emails = await emailsDeCliente(clean);
    if (!ownerEmail || !emails.includes(ownerEmail)) return null;

    // limite_almacenamiento_mb pedido con reintento sin la columna (SQL de
    // almacenamiento sin correr) — no debe tumbar la subida de archivos.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let proy: any = (await sb.from("proyectos").select("id, contacto_id, folio, titulo, tipo, limite_almacenamiento_mb").eq("order_id", orderId).maybeSingle()).data;
    if (!proy) {
      proy = (await sb.from("proyectos").select("id, contacto_id, folio, titulo, tipo").eq("order_id", orderId).maybeSingle()).data;
    }
    if (!proy) return null;
    return {
      proyectoId: proy.id as string,
      contactoId: (proy.contacto_id as string | null) ?? null,
      folio: (proy.folio as string | null) ?? null,
      titulo: (proy.titulo as string | null) ?? null,
      tipo: (proy.tipo as string | null) ?? null,
      limiteAlmacenamientoMb: "limite_almacenamiento_mb" in proy ? (Number(proy.limite_almacenamiento_mb) || null) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Detalle de un pedido del cliente con el avance FINO de tareas visibles del
 * proyecto ligado. Devuelve null si el pedido no es de este correo.
 */
export async function getPedidoDetalle(email: string, orderId: string): Promise<PedidoDetalle | null> {
  const clean = email.trim().toLowerCase();
  const sb = supabaseAdmin();
  try {
    const { data: o } = await sb
      .from("orders")
      .select("id, type, status, summary, created_at, customers(email)")
      .eq("id", orderId)
      .maybeSingle();
    if (!o) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ownerEmail = ((o.customers as any)?.email as string | null)?.toLowerCase();
    const emails = await emailsDeCliente(clean);
    if (!ownerEmail || !emails.includes(ownerEmail)) return null; // no es su pedido (ni de un correo ligado)

    let proyectoEstado: string | null = null;
    let entregableUrl: string | null = null;
    let revisionActual = 0;
    let esAlbum = false;
    let tareas: PedidoTarea[] = [];
    const { data: proy } = await sb.from("proyectos").select("id, tipo, estado, entregable_url, revision_actual").eq("order_id", orderId).maybeSingle();
    if (proy) {
      proyectoEstado = (proy.estado as string) ?? null;
      entregableUrl = (proy.entregable_url as string | null) ?? null;
      revisionActual = Number(proy.revision_actual) || 0;
      esAlbum = ["ep", "album"].includes(String(proy.tipo ?? ""));
      const { data: ts } = await sb
        .from("proyecto_tareas")
        .select("id, titulo, hecho, completado_at, orden, visible_cliente, revision")
        .eq("proyecto_id", proy.id)
        .eq("visible_cliente", true)
        .order("orden", { ascending: true });

      // Pasos internos de cada tarea. Solo se piden los de tareas VISIBLES:
      // las subtareas no tienen bandera propia, así que heredan la del padre.
      const ids = (ts ?? []).map((t) => t.id as string);
      const subsPorTarea = new Map<string, { tot: number; hechas: number }>();
      if (ids.length) {
        const { data: subs } = await sb
          .from("proyecto_subtareas")
          .select("tarea_id, hecho")
          .in("tarea_id", ids);
        for (const s of subs ?? []) {
          const k = s.tarea_id as string;
          const acc = subsPorTarea.get(k) ?? { tot: 0, hechas: 0 };
          acc.tot++;
          if (s.hecho) acc.hechas++;
          subsPorTarea.set(k, acc);
        }
      }

      tareas = (ts ?? []).map((t) => {
        const sub = subsPorTarea.get(t.id as string) ?? { tot: 0, hechas: 0 };
        return {
          id: t.id as string,
          titulo: t.titulo as string,
          hecho: Boolean(t.hecho),
          completadoAt: (t.completado_at as string | null) ?? null,
          revision: Number(t.revision) || 0,
          subHechas: sub.hechas,
          subTotal: sub.tot,
        };
      });
    }
    const hechas = tareas.filter((t) => t.hecho).length;
    const total = tareas.length;
    // Avance ponderado, IGUAL que el del tablero del equipo (getProyectos):
    // cada tarea vale lo mismo y una tarea a medias aporta su fracción de pasos.
    // Antes se contaban tareas enteras y una canción al 80% valía 0 para el cliente.
    const avance = tareas.reduce(
      (a, t) => a + (t.hecho ? 1 : t.subTotal > 0 ? t.subHechas / t.subTotal : 0),
      0,
    );
    return {
      orderId: o.id as string,
      concepto: (o.summary as string | null) || "Tu producción",
      status: (o.status as string) || "nuevo",
      tipo: o.type === "servicio" ? "servicio" : "beat",
      fecha: (o.created_at as string) || new Date().toISOString(),
      proyectoEstado,
      entregableUrl,
      revisionActual,
      esAlbum,
      tareas,
      hechas,
      total,
      pct: total > 0 ? Math.round((avance / total) * 100) : 0,
    };
  } catch {
    return null;
  }
}

/** Contratos del cliente (excluye borradores que aún no se le comparten). */
export async function getClienteContratos(email: string): Promise<ClienteContrato[]> {
  try {
    const sb = supabaseAdmin();
    const emails = await emailsDeCliente(email);
    const { data } = await sb
      .from("contratos")
      .select("id, folio, concepto, estado, created_at")
      .in("cliente_email", emails)
      .neq("estado", "borrador")
      .order("created_at", { ascending: false });
    return (data ?? []).map((c) => ({
      id: c.id as string,
      folio: (c.folio as string) || "",
      concepto: (c.concepto as string | null) ?? null,
      estado: (c.estado as string) || "enviado",
      fecha: (c.created_at as string) || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}
