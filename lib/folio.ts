import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Siguiente folio secuencial para una tabla, con prefijo (ej. "COT-0001").
 * Mismo esquema que usa Producción para proyectos/ventas.
 */
export async function nextFolio(sb: SupabaseClient, table: string, prefix: string): Promise<string> {
  const { data } = await sb
    .from(table)
    .select("folio")
    .like("folio", prefix + "%")
    .order("folio", { ascending: false })
    .limit(1);
  let n = 0;
  const prev = data?.[0]?.folio as string | undefined;
  if (prev) {
    const m = parseInt(prev.replace(/\D/g, ""), 10);
    if (!isNaN(m)) n = m;
  }
  return prefix + String(n + 1).padStart(4, "0");
}
