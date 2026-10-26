import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leerGastosRegistrados } from "@/lib/gastos-recurrentes-data";
import { combinarConRegistrados, type GastoRecurrenteRegistrado } from "@/lib/gastos-recurrentes";
import { calcularBolsas, promedioTresMeses, sueldoSocio } from "@/lib/bolsas";
import { agruparMeses, armarPartidas, costosRecurrentes, hoyEnMexico, type DatosOperacion, type FuenteOperacion } from "@/lib/operacion";

/**
 * Arma lo que la pestaña Operación del Dashboard necesita: cuánto cuesta
 * mantener abierto el estudio (equipo + sueldo escalonado de socios + pagos
 * recurrentes) y lo cobrado mes a mes. Se parte de lo que `getDashboardData` ya
 * leyó; lo único que consulta aquí son los pagos recurrentes registrados a mano
 * (unas cuantas filas). Si algo falla devuelve null y el resto del Dashboard
 * sigue funcionando.
 */
export async function getDatosOperacion(fuente: FuenteOperacion): Promise<DatosOperacion | null> {
  try {
    const hoy = hoyEnMexico();
    const mesActual = hoy.slice(0, 7);

    const filas = await leerGastosRegistrados(supabaseAdmin());
    const registrados: GastoRecurrenteRegistrado[] = filas.map((r) => ({
      id: r.id as string,
      nombre: r.nombre as string,
      categoria: (r.categoria as string | null) ?? null,
      proveedor: (r.proveedor as string | null) ?? null,
      montoEstimado: Number(r.monto_estimado) || 0,
      diaMes: Number(r.dia_mes) || 1,
      cadaMeses: Number(r.cada_meses) || 1,
      activo: r.activo !== false,
    }));
    // Misma mezcla que el cron de avisos: lo registrado gana sobre lo detectado del historial.
    const combinados = combinarConRegistrados(registrados, fuente.egresos, hoy);
    const recurrentes = costosRecurrentes({ registrados, combinados, hoy });

    const meses = agruparMeses(fuente.movimientos);
    // Sueldo de cada socio según el promedio cobrado de los 3 meses anteriores (escalones de Finanzas).
    const sueldoSocioSemanal = sueldoSocio(promedioTresMeses(meses, mesActual).promedio, fuente.ajustes.escalones);
    const partidas = armarPartidas({ equipo: fuente.equipo, recurrentes, sueldoSocioSemanal });

    const conSaldo = calcularBolsas(meses, fuente.ajustes).filter((b) => b.mes <= mesActual && b.colchonSaldo !== null);
    const colchonSaldo = conSaldo.length > 0 ? conSaldo[conSaldo.length - 1].colchonSaldo : null;

    return { meses, partidas, impuestosPct: fuente.ajustes.impuestosPct, colchonSaldo };
  } catch (error) {
    console.error("[operacion] no se pudo armar la pestaña Operación:", error);
    return null;
  }
}
