import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { OndaDatos } from "@/lib/onda-rango";

/**
 * La onda publicada por el script local para una versión del .rpp (ver
 * supabase-render-ondas.sql), o null.
 *
 * Null también cuando la tabla no existe todavía: el SQL se corre a mano y el
 * sitio puede desplegarse antes. La onda es un complemento del cuadro de render,
 * nunca una razón para que no abra (mismo criterio que las columnas nuevas de
 * `renderizables`).
 */
export async function ondaDe(clave: string, archivo: string): Promise<OndaDatos | null> {
  const { data, error } = await supabaseAdmin()
    .from("render_ondas")
    .select("duracion, picos, items, omitidos, mtime")
    .eq("clave", clave)
    .eq("archivo", archivo)
    .maybeSingle();
  if (error || !data) return null;
  const duracion = Number(data.duracion);
  // Duración 0 = proyecto sin items: no hay nada que dibujar.
  if (!(duracion > 0) || typeof data.picos !== "string" || !data.picos) return null;
  return {
    duracion,
    picos: data.picos,
    items: Number(data.items) || 0,
    omitidos: Number(data.omitidos) || 0,
    mtime: Number(data.mtime),
  };
}
