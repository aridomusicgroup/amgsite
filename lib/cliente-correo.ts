import "server-only";
import { registrarActividad, nombreDeActor } from "@/lib/actividad";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Corrige el correo del CLIENTE (tabla `customers`, no `contactos` de CRM —
 * son mundos separados) cuando se capturó mal en un pedido. Mueve todo lo que
 * cuelga de ese correo para que el cliente recupere el acceso a su panel de
 * inmediato, con el correo correcto: la ficha de `customers` (así es que
 * `/cuenta` encuentra sus pedidos), la contraseña si ya tenía una (para que
 * no tenga que volver a hacer "primera vez"), y cualquier alias que
 * apuntara al correo viejo (`cliente_alias`, ver lib/cuenta-cliente.ts).
 *
 * Dos puntos de entrada la usan: editar un pedido en /admin/pedidos, y el
 * aviso de correo distinto en la ficha del contacto en /admin/clientes — por
 * eso vive aparte en vez de solo en la ruta de pedidos.
 */
export async function corregirCorreoDeOrder(
  sb: SB,
  orderId: string,
  correoNuevoCrudo: string,
  actor: string,
): Promise<{ error: string; status: number } | null> {
  const correoNuevo = correoNuevoCrudo.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correoNuevo)) {
    return { error: "Correo inválido.", status: 400 };
  }

  const { data: ord } = await sb.from("orders").select("customer_id").eq("id", orderId).single();
  if (!ord?.customer_id) return { error: "Este pedido no tiene cliente enlazado.", status: 400 };

  const { data: cust } = await sb.from("customers").select("email, name").eq("id", ord.customer_id).single();
  const correoAnterior = ((cust?.email as string | null) ?? "").trim().toLowerCase();
  if (!correoAnterior || correoAnterior === correoNuevo) return null; // nada que mover

  // No pisar a otro cliente que ya tenga ese correo — eso es "fusionar", no "corregir".
  const { data: choque } = await sb.from("customers").select("id").eq("email", correoNuevo).neq("id", ord.customer_id).maybeSingle();
  if (choque) {
    return { error: "Ya existe otro cliente con ese correo. Habla con soporte para fusionarlos en vez de solo corregir.", status: 409 };
  }

  const { error: custErr } = await sb.from("customers").update({ email: correoNuevo }).eq("id", ord.customer_id);
  if (custErr) return { error: custErr.message, status: 500 };

  // Mueve la contraseña si ya tenía una, para que no pierda el acceso que ya había creado.
  const { data: cred } = await sb.from("cliente_credenciales").select("password_hash").eq("email", correoAnterior).maybeSingle();
  if (cred?.password_hash) {
    await sb.from("cliente_credenciales").upsert({ email: correoNuevo, password_hash: cred.password_hash, updated_at: new Date().toISOString() }, { onConflict: "email" });
    await sb.from("cliente_credenciales").delete().eq("email", correoAnterior);
  }

  // Repuntea cualquier alias que colgara del correo viejo (en cualquiera de los dos lados).
  await sb.from("cliente_alias").update({ principal_email: correoNuevo }).eq("principal_email", correoAnterior);
  await sb.from("cliente_alias").update({ alias_email: correoNuevo }).eq("alias_email", correoAnterior);

  try {
    const quien = await nombreDeActor(sb, actor);
    await registrarActividad(sb, {
      tipo: "contacto_editado",
      titulo: `${quien} corrigió el correo del pedido de ${(cust?.name as string) || "un cliente"}: ${correoAnterior} → ${correoNuevo}`,
      actor,
      meta: { correo_anterior: correoAnterior, correo_nuevo: correoNuevo, customer_id: ord.customer_id, order_id: orderId },
    });
  } catch { /* bitácora best-effort */ }

  return null;
}

export interface CorreoPedidoContacto {
  /** Sin proyectos con pedido ligado — nada que revisar (típico de clientes solo-BeatStars). */
  estado: "sin_pedido" | "coincide" | "distinto" | "ambiguo";
  /** Solo si estado="distinto": el pedido concreto a corregir. */
  orderId?: string;
  /** Correo que tiene HOY el pedido (o los pedidos, si es ambiguo). */
  correoPedido?: string;
  correosDistintos?: string[];
  /** Folio/título del proyecto, para que el aviso diga de qué pedido habla. */
  proyecto?: string;
}

/**
 * ¿El correo de este contacto (CRM) coincide con el de sus pedidos con
 * producción? Solo mira proyectos con `order_id` — los clientes que solo
 * compran en BeatStars nunca tienen fila en `orders`, así que para ellos
 * siempre da "sin_pedido" (correcto: no hay panel de progreso que revisar).
 *
 * Se llama BAJO DEMANDA (al abrir la ficha de un contacto), nunca al cargar
 * la lista completa de Clientes — recorrer esto para 300 contactos de golpe
 * sería una consulta extra por cada uno.
 */
export async function correoDelPedidoDeContacto(sb: SB, contactoId: string, correoContacto: string | null): Promise<CorreoPedidoContacto> {
  const { data: proys } = await sb
    .from("proyectos")
    .select("folio, titulo, order_id")
    .eq("contacto_id", contactoId)
    .not("order_id", "is", null);

  const conOrder: { folio: string; titulo: string; order_id: string }[] = proys ?? [];
  if (conOrder.length === 0) return { estado: "sin_pedido" };

  const orderIds = conOrder.map((p) => p.order_id);
  const { data: orders } = await sb.from("orders").select("id, customer_id").in("id", orderIds);
  const customerIds = [...new Set((orders ?? []).map((o: { customer_id: string | null }) => o.customer_id).filter(Boolean))];
  const { data: customers } = await sb.from("customers").select("id, email").in("id", customerIds);
  const emailPorCustomer = new Map<string, string>((customers ?? []).map((c: { id: string; email: string }) => [c.id, (c.email || "").trim().toLowerCase()]));
  const customerPorOrder = new Map<string, string>((orders ?? []).map((o: { id: string; customer_id: string }) => [o.id, o.customer_id]));

  const correosVistos = new Set<string>();
  for (const p of conOrder) {
    const custId = customerPorOrder.get(p.order_id);
    const correo = custId ? emailPorCustomer.get(custId) : undefined;
    if (correo) correosVistos.add(correo);
  }

  if (correosVistos.size === 0) return { estado: "sin_pedido" };

  if (correosVistos.size > 1) {
    return { estado: "ambiguo", correosDistintos: [...correosVistos] };
  }

  const correoPedido = [...correosVistos][0];
  const correoLimpio = (correoContacto || "").trim().toLowerCase();
  if (correoPedido === correoLimpio) return { estado: "coincide", correoPedido };

  const primero = conOrder[0];
  return { estado: "distinto", orderId: primero.order_id, correoPedido, proyecto: `${primero.folio} — ${primero.titulo}` };
}
