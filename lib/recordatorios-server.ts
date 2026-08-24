import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { MiRecordatorio } from "@/lib/recordatorios";

/**
 * Mis recordatorios, por tarea. Se pide aparte (y no dentro de `getProyectos`)
 * porque depende de QUIÉN está viendo el tablero: dos personas abren la misma
 * pantalla y cada quien ve el suyo.
 *
 * Best-effort a propósito: si la tabla todavía no existe (falta correr
 * `supabase-recordatorios.sql`), el tablero se dibuja igual sin recordatorios en
 * vez de reventar la página entera de Producción.
 */
export async function misRecordatorios(email: string): Promise<Record<string, MiRecordatorio>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("tarea_recordatorios")
      .select("tarea_id, recordar_at, nota, enviado_at")
      .eq("email", email.toLowerCase());
    if (error || !data) return {};
    const out: Record<string, MiRecordatorio> = {};
    for (const r of data) {
      out[r.tarea_id as string] = {
        recordar_at: r.recordar_at as string,
        nota: (r.nota as string | null) ?? null,
        enviado_at: (r.enviado_at as string | null) ?? null,
      };
    }
    return out;
  } catch {
    return {};
  }
}
