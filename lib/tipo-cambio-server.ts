import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TIPO_CAMBIO_FALLBACK } from "@/lib/tipo-cambio";

/** Cuántas ventas recientes se promedian para sugerir el tipo de cambio. */
const MUESTRA = 10;

/**
 * Tipo de cambio sugerido: el promedio de las últimas ventas en dólares.
 *
 * Sale de los datos del propio negocio y no de una constante escrita a mano, así
 * que se mueve solo conforme se factura. Se ordena por FECHA de venta (no por
 * captura) para que el histórico que se importó de BeatStars —todo con el mismo
 * tipo de cambio y fechas viejas— no jale el promedio hacia atrás.
 *
 * Es solo una sugerencia: quien cotiza puede escribir otro en el formulario.
 */
export async function tipoCambioSugerido(): Promise<number> {
  try {
    const { data } = await supabaseAdmin()
      .from("ventas")
      .select("tipo_cambio, fecha")
      .not("tipo_cambio", "is", null)
      .gt("tipo_cambio", 0)
      .order("fecha", { ascending: false })
      .limit(MUESTRA);

    const tcs = (data ?? []).map((v) => Number(v.tipo_cambio)).filter((n) => n > 0 && n < 100);
    if (!tcs.length) return TIPO_CAMBIO_FALLBACK;
    return Math.round((tcs.reduce((a, b) => a + b, 0) / tcs.length) * 100) / 100;
  } catch {
    return TIPO_CAMBIO_FALLBACK;
  }
}
