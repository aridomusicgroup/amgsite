import "server-only";
import { PROY_TO_ORDER } from "@/lib/estado-sync";
import { registrarActividad } from "@/lib/actividad";
import { seguimientoAuto, DIAS_TRAS_ENTREGA } from "@/lib/seguimiento-auto";
import { pushAResponsables } from "@/lib/push";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Lo que pasa cuando un proyecto cambia de etapa.
 *
 * Vivía dentro del PATCH de proyectos. Salió de ahí porque ahora hay DOS
 * caminos a "Entregado": arrastrar la tarjeta, y la entrega automática (todo en
 * Drive + cliente liquidado). Si cada uno hiciera lo suyo, un proyecto
 * entregado solo se quedaría sin contrato, sin seguimiento de conformidad o con
 * el pedido del cliente atorado en "en producción".
 */

const hoy = () => new Date().toISOString().slice(0, 10);

async function nextFolio(sb: SB, table: string, prefix: string): Promise<string> {
  const { data } = await sb.from(table).select("folio").like("folio", prefix + "%").order("folio", { ascending: false }).limit(1);
  let n = 0;
  const prev = data?.[0]?.folio as string | undefined;
  if (prev) { const m = parseInt(prev.replace(/\D/g, ""), 10); if (!isNaN(m)) n = m; }
  return prefix + String(n + 1).padStart(4, "0");
}

// Al concluir una producción (entregado/cerrado) genera el contrato en BORRADOR
// con los datos que ya teníamos (contacto + venta). Idempotente: 1 por proyecto.
async function autogenerarContrato(sb: SB, proyectoId: string, actorEmail: string) {
  const { data: yaHay } = await sb.from("contratos").select("id").eq("proyecto_id", proyectoId).limit(1);
  if (yaHay && yaHay.length) return; // ya existe → no duplicar

  const { data: p } = await sb.from("proyectos")
    .select("id, folio, titulo, tipo, contacto_id, venta_id, cotizacion_id, responsables")
    .eq("id", proyectoId).single();
  if (!p) return;
  // Solo las producciones de BEAT PERSONALIZADO generan contrato automático.
  // (La exclusiva de la tienda ya emite su contrato al momento de la compra.)
  if (p.tipo !== "beat_personalizado") return;

  let contacto: { nombre: string | null; email: string | null; telefono: string | null; direccion: string | null } | null = null;
  if (p.contacto_id) {
    const { data } = await sb.from("contactos").select("nombre, email, telefono, direccion").eq("id", p.contacto_id).single();
    contacto = data ?? null;
  }
  let venta: { total_mxn: number | null; moneda: string | null; beat_nombre: string | null; cotizacion_id: string | null } | null = null;
  if (p.venta_id) {
    const { data } = await sb.from("ventas").select("total_mxn, moneda, beat_nombre, cotizacion_id").eq("id", p.venta_id).single();
    venta = data ?? null;
  }

  const tipo = "beat_personalizado";
  const concepto = venta?.beat_nombre || p.titulo || "Producción";
  const folio = await nextFolio(sb, "contratos", "CONT-");

  await sb.from("contratos").insert({
    folio, tipo,
    cotizacion_id: p.cotizacion_id || venta?.cotizacion_id || null,
    venta_id: p.venta_id || null,
    proyecto_id: p.id,
    contacto_id: p.contacto_id || null,
    cliente_nombre: contacto?.nombre || null,
    cliente_email: contacto?.email || null,
    cliente_telefono: contacto?.telefono || null,
    cliente_direccion: contacto?.direccion || null,
    moneda: venta?.moneda || "MXN",
    monto: Number(venta?.total_mxn) || 0,
    concepto,
    estado: "borrador",
    creado_por: "auto",
  });

  try {
    const resp = ((p.responsables as string[] | null) ?? []).filter(Boolean);
    if (resp.length) {
      await pushAResponsables(sb, resp, {
        titulo: "Contrato listo para revisar",
        cuerpo: `Se generó el contrato de “${concepto}” (${folio}). Revísalo y envíalo.`,
        url: "/admin/cotizaciones",
      });
    }
    await registrarActividad(sb, {
      tipo: "contrato_auto",
      titulo: `Se generó el contrato ${folio} (borrador) al concluir “${concepto}”`,
      actor: actorEmail, proyecto_id: proyectoId, meta: { folio, tipo },
    });
  } catch { /* aviso best-effort */ }
}

/**
 * Los efectos de pasar a `estado`. Best-effort: el cambio de etapa ya se
 * guardó y no se deshace porque falle un correo o un contrato.
 */
export async function efectosDeCambioDeEstado(
  sb: SB, id: string, estado: string, previo: string | null | undefined, actor: string,
): Promise<void> {
  // Al concluir la producción, genera el contrato en borrador (una sola vez).
  if ((estado === "entregado" || estado === "cerrado") && estado !== previo) {
    try { await autogenerarContrato(sb, id, actor); } catch (e) { console.error("auto-contrato:", e); }

    // Aquí se reanuda el seguimiento del cliente: entregado ya hay de qué
    // hablar. De este punto en adelante lo toma recompra, cuyo reloj corre
    // aparte desde la última venta.
    const { data: proyC } = await sb.from("proyectos").select("contacto_id, titulo").eq("id", id).single();
    await seguimientoAuto(sb, {
      contactoId: (proyC?.contacto_id as string | null) ?? null,
      accion: `Confirmar que quedó conforme con ${(proyC?.titulo as string) || "la entrega"}`,
      dias: DIAS_TRAS_ENTREGA,
      motivo: `se entregó ${(proyC?.titulo as string) || "el proyecto"}`,
      actor,
    });
  }

  // Sincroniza el estado del pedido del sitio ligado → lo ve el cliente en "Mis compras".
  if (PROY_TO_ORDER[estado]) {
    try {
      const { data: proy } = await sb.from("proyectos").select("order_id").eq("id", id).single();
      const orderId = (proy?.order_id as string | null) ?? null;
      if (orderId) await sb.from("orders").update({ status: PROY_TO_ORDER[estado] }).eq("id", orderId);
    } catch { /* sin pedido ligado o columna ausente: ignorar */ }
  }
}

/**
 * Pasa un proyecto a Entregado sin que nadie arrastre la tarjeta.
 *
 * Sólo desde una etapa abierta: un proyecto que alguien ya cerró, canceló o
 * dejó en pausa no se reabre porque terminó una subida.
 */
export async function moverAEntregado(sb: SB, id: string, actor: string, motivo: string): Promise<boolean> {
  const { data: prev } = await sb.from("proyectos").select("titulo, estado").eq("id", id).maybeSingle();
  if (!prev || !["cola", "produccion", "revision"].includes(prev.estado as string)) return false;

  const { error } = await sb.from("proyectos")
    .update({ estado: "entregado", fecha_entrega_real: hoy(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return false;

  await efectosDeCambioDeEstado(sb, id, "entregado", prev.estado as string, actor);
  await registrarActividad(sb, {
    tipo: "proyecto_estado",
    titulo: `“${prev.titulo ?? "El proyecto"}” pasó a Entregado solo: ${motivo}`,
    actor, proyecto_id: id, meta: { de: prev.estado, a: "entregado", automatico: true },
  });
  return true;
}
