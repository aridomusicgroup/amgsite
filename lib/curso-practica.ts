import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calcularRacha, hoyMx, minutosSemana } from "@/lib/cursos-tipos";

/** Racha, minutos de la semana y de hoy de una cuenta en un curso (últimos 60 días). */
export async function resumenPractica(emails: string[], cursoId: string): Promise<{ racha: number; semana: number; hoy: number }> {
  const hoy = hoyMx();
  const desde = new Date(Date.parse(`${hoy}T00:00:00Z`) - 60 * 86_400_000).toISOString().slice(0, 10);
  try {
    const { data, error } = await supabaseAdmin()
      .from("curso_practica")
      .select("fecha, minutos")
      .eq("curso_id", cursoId)
      .in("email", emails)
      .gte("fecha", desde);
    if (error) return { racha: 0, semana: 0, hoy: 0 };
    const regs = (data ?? []).map((r) => ({ fecha: String(r.fecha), minutos: Number(r.minutos) || 0 }));
    return {
      racha: calcularRacha(regs.map((r) => r.fecha), hoy),
      semana: minutosSemana(regs, hoy),
      hoy: regs.filter((r) => r.fecha === hoy).reduce((a, r) => a + r.minutos, 0),
    };
  } catch {
    return { racha: 0, semana: 0, hoy: 0 };
  }
}
