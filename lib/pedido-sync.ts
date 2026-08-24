import { PROY_TO_ORDER } from "./estado-sync";

// Tipos que NO son trabajo de cliente: creación de contenido propio y beats de
// catálogo. Esos nunca generan un "pedido" (el cliente no debe verlos en /cuenta).
// Mismo criterio que la UI del tablero (`esContenido`). Las tareas internas ya
// quedan fuera por `clase !== "produccion"`.
export const TIPOS_NO_CLIENTE = ["creacion_contenido", "contenido", "beat"];

/** ¿Es un proyecto de PRODUCCIÓN para un cliente? (no contenido, no beats, no interno) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function esProyectoDeCliente(p: { clase?: string | null; tipo?: string | null }): boolean {
  return p.clase === "produccion" && !TIPOS_NO_CLIENTE.includes(String(p.tipo ?? ""));
}

/**
 * Al crear un proyecto de PRODUCCIÓN de cliente, dispara/enlaza un "pedido" del
 * sitio (`orders`) para que el cliente lo vea en su panel con el avance en vivo.
 * El estado del pedido queda ligado al del proyecto (lo sincroniza el PATCH de
 * proyectos vía `order_id`). Idempotente: no crea si el proyecto ya tiene pedido.
 * NO aplica a contenido propio, beats de catálogo ni tareas internas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function crearPedidoDeProyecto(sb: any, proyectoId: string): Promise<void> {
  const { data: p } = await sb
    .from("proyectos")
    .select("id, titulo, estado, clase, tipo, order_id, contacto_id, venta_id")
    .eq("id", proyectoId)
    .single();
  if (!p || !esProyectoDeCliente(p) || p.order_id) return;
  if (!p.contacto_id) return; // sin cliente no hay a quién mostrárselo

  const { data: ct } = await sb.from("contactos").select("nombre, email, telefono").eq("id", p.contacto_id).single();
  const email = String(ct?.email || "").trim().toLowerCase();
  if (!email) return; // sin correo el cliente no puede iniciar sesión → no creamos pedido

  let total = 0;
  let moneda = "MXN";
  if (p.venta_id) {
    const { data: v } = await sb.from("ventas").select("total_mxn, moneda").eq("id", p.venta_id).single();
    total = Number(v?.total_mxn) || 0;
    moneda = (v?.moneda as string) || "MXN";
  }

  // customers: upsert por correo sin pisar nombre/teléfono existentes (undefined se omite).
  const { data: cust } = await sb
    .from("customers")
    .upsert({ email, name: ct?.nombre || undefined, phone: ct?.telefono || undefined }, { onConflict: "email" })
    .select("id")
    .single();

  const status = PROY_TO_ORDER[p.estado as string] || "nuevo";
  const { data: order } = await sb
    .from("orders")
    .insert({
      // `stripe_session_id` es NOT NULL (y único) en `orders`. Los pedidos que
      // nacen del CRM no vienen de Stripe, así que usamos un id sintético y
      // determinista por proyecto (no colisiona con las sesiones de Stripe).
      stripe_session_id: `proj_${p.id}`,
      customer_id: cust?.id ?? null,
      type: "servicio",
      status,
      total,
      currency: moneda.toUpperCase(),
      summary: p.titulo,
    })
    .select("id")
    .single();
  if (!order?.id) return;

  await sb.from("order_items").insert({ order_id: order.id, description: p.titulo, amount: total, quantity: 1 });
  await sb.from("proyectos").update({ order_id: order.id }).eq("id", p.id);
}
