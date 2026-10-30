import "server-only";
import { nombreCarpeta } from "@/lib/carpeta-reaper";
import { herenciaReaper, type HerenciaReaper } from "@/lib/mezcla-voces";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * La sesión de REAPER que hereda una mezcla de voces del tema que ya produjimos.
 *
 * La regla vive en `lib/mezcla-voces.ts` (pura, con pruebas); aquí solo se lee
 * el proyecto original. Lo usan los dos caminos que crean la venta desde una
 * cotización — el pago por Stripe y "Convertir en venta" — para que armen lo
 * mismo. Devuelve `null` si el proyecto debe nacer con su propia carpeta.
 *
 * `reaper_carpeta` es una columna del ancla de nombres: si todavía no existe
 * (SQL sin correr) se pide sin ella, y el nombre sale del título.
 */
export async function herenciaReaperDeOrigen(
  sb: SB,
  origenId: string | null | undefined,
  contactoId: string | null,
): Promise<HerenciaReaper | null> {
  if (!origenId) return null;
  try {
    let r = await sb.from("proyectos").select("tipo, titulo, contacto_id, reaper_carpeta").eq("id", origenId).maybeSingle();
    if (r.error) r = await sb.from("proyectos").select("tipo, titulo, contacto_id").eq("id", origenId).maybeSingle();
    if (!r.data) return null;
    return herenciaReaper(
      {
        tipo: (r.data.tipo as string | null) ?? null,
        titulo: (r.data.titulo as string | null) ?? null,
        reaper_carpeta: (r.data.reaper_carpeta as string | null | undefined) ?? null,
        contacto_id: (r.data.contacto_id as string | null) ?? null,
      },
      contactoId,
      nombreCarpeta,
    );
  } catch (e) {
    // Mejor un proyecto con su propia carpeta que una venta sin proyecto.
    console.error("herenciaReaperDeOrigen:", e);
    return null;
  }
}
