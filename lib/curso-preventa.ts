import "server-only";
import { accesoVigente, estadoVenta, hoyMx, leerConfig, type Venta } from "@/lib/cursos-tipos";

/**
 * Datos de la preventa que salen de la base: cuántos lugares se han vendido y
 * quién pidió que le avisaran. La regla de precio es `estadoVenta` (pura).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/** La lista “Avísame” de un curso vive en curso_interes con este producto. */
export const productoAviso = (cursoId: string) => `aviso:${cursoId}`;

/** Lugares vendidos = accesos que dio una venta (los manuales no cuentan). */
export async function contarFundadores(sb: SB, cursoId: string): Promise<number> {
  const { count } = await sb.from("curso_accesos").select("id", { count: "exact", head: true })
    .eq("curso_id", cursoId).eq("origen", "venta");
  return count ?? 0;
}

/** Estado de venta de una fila de `cursos` (necesita id, activo, precio_mxn, config). */
export async function ventaDeCurso(
  sb: SB,
  c: { id: string; activo: boolean | null; precio_mxn: number | string | null; config: unknown },
): Promise<Venta> {
  const { preventa } = leerConfig(c.config);
  // Sólo hace falta contar si hay cupo que cuidar.
  const vendidos = preventa.activa && preventa.cupo ? await contarFundadores(sb, c.id) : 0;
  return estadoVenta({
    activo: Boolean(c.activo),
    preventa,
    precioRegular: c.precio_mxn == null ? null : Number(c.precio_mxn),
    vendidos,
    hoy: hoyMx(),
  });
}

/** Correos de la lista Avísame (sin repetir, en minúsculas). */
export async function listaAvisame(sb: SB, cursoId: string): Promise<string[]> {
  const { data } = await sb.from("curso_interes").select("email").eq("producto", productoAviso(cursoId)).order("created_at");
  return [...new Set(((data ?? []) as { email: string }[]).map((r) => r.email.trim().toLowerCase()))];
}

/** Correos con acceso vigente al curso (para no mandarles “ya abrió, inscríbete”). */
export async function correosConAcceso(sb: SB, cursoId: string): Promise<string[]> {
  const { data } = await sb.from("curso_accesos").select("email, vence_en").eq("curso_id", cursoId);
  return [...new Set(((data ?? []) as { email: string; vence_en: string | null }[])
    .filter((a) => accesoVigente(a.vence_en))
    .map((a) => a.email.trim().toLowerCase()))];
}
