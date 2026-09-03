import "server-only";

/**
 * Lo que hay que arrastrar al fusionar dos contactos.
 *
 * Vive aquí porque las DOS rutas que fusionan (`/api/admin/merge` manual y
 * `/api/admin/dedup` automático) tenían su propia copia de la lista, y las dos
 * se quedaron cortas: movían ventas, identidades e interacciones, pero dejaban
 * atrás proyectos, contratos y cotizaciones.
 *
 * El resultado era invisible: el contacto fusionado se oculta con `merged_into`
 * y casi todo el panel filtra por eso, así que su proyecto y su contrato
 * simplemente dejaban de aparecer en cualquier lado. Se encontró el 2026-09-03
 * revisando a "Jehu Nuñez": tenía un proyecto (P0032) y un contrato colgados de
 * una ficha oculta.
 *
 * Si algún día se agrega otra tabla con `contacto_id`, va aquí.
 */
export const TABLAS_DEL_CONTACTO = [
  "ventas",
  "identidades_canal",
  "interacciones",
  "proyectos",
  "contratos",
  "cotizaciones",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * Pasa el seguimiento pendiente del contacto que desaparece al que sobrevive.
 *
 * Sólo si el sobreviviente NO tiene uno propio: pisarlo perdería la tarea que
 * alguien ya había agendado, y el aviso diario lee `proxima_fecha` sin más — un
 * seguimiento en una ficha oculta no suena nunca.
 */
export async function heredarSeguimiento(sb: SB, deId: string, aId: string): Promise<void> {
  const { data: de } = await sb
    .from("contactos")
    .select("proxima_fecha, proxima_accion")
    .eq("id", deId)
    .maybeSingle();
  if (!de?.proxima_fecha) return;

  const { data: a } = await sb.from("contactos").select("proxima_fecha").eq("id", aId).maybeSingle();
  if (a?.proxima_fecha) return; // el sobreviviente ya tiene el suyo: no se toca

  await sb
    .from("contactos")
    .update({ proxima_fecha: de.proxima_fecha, proxima_accion: de.proxima_accion })
    .eq("id", aId);
  await sb.from("contactos").update({ proxima_fecha: null, proxima_accion: null }).eq("id", deId);
}
