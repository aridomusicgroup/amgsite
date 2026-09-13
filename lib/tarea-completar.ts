import "server-only";
import { Resend } from "resend";
import { progresoTareaEmail } from "@/lib/emails";
import { entregaTrasPalomear, entregaParaQuienPalomeo, type EntregaLista } from "@/lib/entrega";
import { avanzarEstadoPorTareas } from "@/lib/estado-auto";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const SITE = "https://aridomusicgroup.com";

/**
 * Al completar una tarea VISIBLE, avisa al cliente por correo con el avance.
 * Best-effort: nunca rompe el flujo del equipo. Solo si el proyecto tiene un
 * pedido ligado (order_id) y el contacto tiene correo.
 */
export async function notificarProgresoCliente(sb: SB, proyectoId: string, tareaTitulo: string) {
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

/**
 * Lo que sigue a que una tarea quede hecha, la haya palomeado una persona en el
 * tablero o el portal de músicos al recibir la última pista. Un solo lugar para
 * que los dos caminos hagan lo mismo: si el portal palomeara "a secas", la
 * columna del proyecto no avanzaría ni se revisaría si ya sólo falta entregar.
 *
 * Quien llama ya marcó `hecho = true` y registra su propia bitácora.
 */
export async function efectosDeTareaCompletada(
  sb: SB,
  d: { tareaId: string; proyectoId: string | null; titulo: string; visibleCliente: boolean | null; actor: string },
): Promise<{ estado: string | null; entrega: EntregaLista | null }> {
  // Al completar la tarea padre, sus subtareas pendientes quedan hechas.
  await sb.from("proyecto_subtareas").update({ hecho: true }).eq("tarea_id", d.tareaId).eq("hecho", false);

  // Primero la columna (Cola → Producción → En revisión), luego la entrega.
  const estado = d.proyectoId ? await avanzarEstadoPorTareas(sb, d.proyectoId, d.actor) : null;
  const entrega = await entregaParaQuienPalomeo(sb, await entregaTrasPalomear(sb, { tareaId: d.tareaId }));

  // Aviso al cliente: sólo de tareas visibles.
  if (d.visibleCliente !== false && d.proyectoId) {
    try { await notificarProgresoCliente(sb, d.proyectoId, d.titulo); }
    catch (e) { console.error("notify-cliente:", e); }
  }
  return { estado, entrega };
}
