import "server-only";
import { registrarActividad } from "@/lib/actividad";
import { anclarCarpeta, type CarpetaPendiente } from "@/lib/carpeta-reaper";

/**
 * Un mismo trabajo tiene nombre en tres lugares: el proyecto (`titulo`), la
 * venta (`beat_nombre`) y el pedido del cliente (`summary`). Nadie los
 * mantenía juntos, así que se separaban: al 11-sep, 8 de los últimos 40
 * proyectos se llamaban distinto en algún lado — P0062 era "Alto Nivel" en
 * Producción y "Paquete Tumbes" en la venta y en el pedido que ve el cliente.
 *
 * Renombrar en cualquiera de los tres renombra los otros, más el contrato si
 * sigue en borrador. Cuidados:
 *   · Sólo si la liga es de uno a uno. Una venta con dos proyectos no se
 *     renombra por uno de ellos (cada proyecto sería una cosa distinta).
 *   · Un contrato ya enviado o firmado NO se toca: es un documento que el
 *     cliente ya tiene.
 *   · Si el proyecto ya tiene carpeta de REAPER, se ancla antes de renombrarlo
 *     (ver lib/carpeta-reaper.ts) y se devuelve para preguntar si se renombra.
 *   · Quien llama sólo debe invocar esto si el nombre CAMBIÓ. Los formularios
 *     mandan todos los campos al guardar; sin esa revisión, cambiar el canal de
 *     una venta renombraría el proyecto sin que nadie lo pidiera.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export type OrigenNombre = "proyecto" | "venta" | "pedido";

export interface ResultadoNombre {
  /** Dónde más se renombró ("la venta", "el pedido del cliente"…). */
  en: string[];
  /** Si el proyecto renombrado tiene carpeta de REAPER: hay que preguntar. */
  carpeta: CarpetaPendiente | null;
}

async function proyectosDeLaVenta(sb: SB, ventaId: string): Promise<number> {
  const { count } = await sb.from("proyectos").select("id", { count: "exact", head: true }).eq("venta_id", ventaId);
  return count ?? 0;
}

export async function propagarNombre(
  sb: SB, origen: OrigenNombre, id: string, nombre: string, actor: string | null,
): Promise<ResultadoNombre> {
  const n = String(nombre ?? "").trim();
  const vacio: ResultadoNombre = { en: [], carpeta: null };
  if (!n) return vacio;

  try {
    let proyectoId: string | null = null;
    let ventaId: string | null = null;
    let orderId: string | null = null;

    if (origen === "proyecto") {
      const { data: p } = await sb.from("proyectos").select("id, venta_id, order_id").eq("id", id).maybeSingle();
      if (!p) return vacio;
      proyectoId = p.id;
      ventaId = p.venta_id ?? null;
      orderId = p.order_id ?? null;
      if (ventaId && (await proyectosDeLaVenta(sb, ventaId)) > 1) ventaId = null;
    } else if (origen === "venta") {
      ventaId = id;
      const { data: ps } = await sb.from("proyectos").select("id, order_id").eq("venta_id", id);
      if ((ps ?? []).length === 1) { proyectoId = ps[0].id; orderId = ps[0].order_id ?? null; }
    } else {
      orderId = id;
      const { data: ps } = await sb.from("proyectos").select("id, venta_id").eq("order_id", id);
      if ((ps ?? []).length === 1) {
        proyectoId = ps[0].id;
        ventaId = ps[0].venta_id ?? null;
        if (ventaId && (await proyectosDeLaVenta(sb, ventaId)) > 1) ventaId = null;
      }
    }

    const en: string[] = [];
    let carpeta: CarpetaPendiente | null = null;
    const ahora = new Date().toISOString();

    if (proyectoId && origen !== "proyecto") {
      const { data: viejo } = await sb.from("proyectos").select("titulo").eq("id", proyectoId).maybeSingle();
      if (viejo && String(viejo.titulo ?? "").trim() !== n) {
        // Antes de tocar el título: que el script no pierda la carpeta.
        carpeta = await anclarCarpeta(sb, "proyectos", proyectoId, viejo.titulo as string, n);
        const { data } = await sb.from("proyectos").update({ titulo: n, updated_at: ahora }).eq("id", proyectoId).select("id");
        if (data?.length) en.push("el proyecto");
      }
    }
    if (ventaId && origen !== "venta") {
      const { data } = await sb.from("ventas").update({ beat_nombre: n }).eq("id", ventaId).select("id");
      if (data?.length) en.push("la venta");
    }
    if (orderId && origen !== "pedido") {
      const { data } = await sb.from("orders").update({ summary: n }).eq("id", orderId).select("id");
      if (data?.length) en.push("el pedido del cliente");
    }

    // Contratos: sólo los que siguen en borrador.
    let contratos = 0;
    for (const [col, val] of [["proyecto_id", proyectoId], ["venta_id", ventaId]] as const) {
      if (!val) continue;
      const { data } = await sb.from("contratos").update({ concepto: n })
        .eq(col, val).eq("estado", "borrador").neq("concepto", n).select("id");
      contratos += data?.length ?? 0;
    }
    if (contratos) en.push(contratos > 1 ? "los contratos en borrador" : "el contrato en borrador");

    if (en.length) {
      await registrarActividad(sb, {
        tipo: "nombre_sincronizado",
        titulo: `Se renombró a “${n}” también en ${en.join(", ")}`,
        actor, proyecto_id: proyectoId,
        meta: { origen, nombre: n, en },
      });
    }
    return { en, carpeta };
  } catch {
    return vacio;
  }
}
