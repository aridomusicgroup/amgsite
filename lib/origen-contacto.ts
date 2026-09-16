import "server-only";
import { limpiarEnlace, normalizarOrigen } from "@/lib/origenes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const UUID = /^[0-9a-f-]{36}$/i;

export interface OrigenEntrada { origen?: unknown; origen_post_id?: unknown; origen_enlace?: unknown }

/**
 * Anota de dónde llegó un contacto.
 *
 * Sin `pisar`, sólo llena lo que el contacto NO tenía: registrar la segunda
 * compra de un cliente no debe borrar que llegó por Instagram hace meses. La
 * edición del CRM sí pisa (es alguien corrigiéndolo a propósito).
 *
 * Tolerante: sin supabase-origen-clientes.sql guarda el canal y omite reel/link.
 */
export async function fijarOrigenContacto(
  sb: SB,
  contactoId: string | null,
  entrada: OrigenEntrada,
  { pisar = false }: { pisar?: boolean } = {},
): Promise<void> {
  if (!contactoId) return;
  const origen = normalizarOrigen(entrada.origen);
  const postId = UUID.test(String(entrada.origen_post_id ?? "")) ? String(entrada.origen_post_id) : null;
  const enlace = limpiarEnlace(entrada.origen_enlace);
  if (!origen && !postId && !enlace) return;

  try {
    const conDetalle = await sb.from("contactos").select("origen, origen_post_id, origen_enlace").eq("id", contactoId).maybeSingle();
    const hayColumnas = !conDetalle.error;
    const actual = hayColumnas
      ? conDetalle.data
      : (await sb.from("contactos").select("origen").eq("id", contactoId).maybeSingle()).data;
    if (!actual) return;

    const patch: Record<string, unknown> = {};
    if (origen && (pisar || !actual.origen)) patch.origen = origen;
    if (hayColumnas) {
      // El reel o el link sólo tienen sentido con su canal.
      const canal = (patch.origen as string | undefined) ?? actual.origen;
      if (postId && canal === "instagram" && (pisar || !actual.origen_post_id)) patch.origen_post_id = postId;
      if (enlace && canal !== "instagram" && (pisar || !actual.origen_enlace)) patch.origen_enlace = enlace;
    }
    if (!Object.keys(patch).length) return;
    patch.updated_at = new Date().toISOString();
    await sb.from("contactos").update(patch).eq("id", contactoId);
  } catch (e) {
    // El origen es un dato de análisis: nunca debe tumbar la venta que se está guardando.
    console.error("fijar-origen-contacto:", e);
  }
}
