import { toast } from "@/lib/toast";

/**
 * El puente entre "guardé algo" y lo que eso desencadena en pantalla.
 *
 * Las palomitas y los formularios de edición viven en muchos lugares, y los
 * cuadros que se abren por ellos (entrega, carpeta de REAPER) viven en uno solo
 * (montados una vez en el menú). En vez de pasar callbacks por árboles
 * distintos, quien guarda lanza un evento y el lanzador lo escucha.
 */
export const EVENTO_ENTREGA = "arido:entrega";
export const EVENTO_CARPETA = "arido:carpeta";

export interface PedidoEntrega {
  proyectoId: string;
  tareaId: string | null;
  titulo?: string;
}

/** Lo que manda el servidor cuando algo renombrado ya tiene carpeta en disco. */
export interface PedidoCarpeta {
  tabla: "contactos" | "proyectos" | "proyecto_tareas";
  id: string;
  actual: string;
  nueva: string;
  sinMigracion?: boolean;
}

const ESTADO_TXT: Record<string, string> = { produccion: "Producción", revision: "En revisión", entregado: "Entregado" };

export function abrirEntrega(d: PedidoEntrega): void {
  window.dispatchEvent(new CustomEvent<PedidoEntrega>(EVENTO_ENTREGA, { detail: d }));
}

export function preguntarCarpeta(d: PedidoCarpeta): void {
  window.dispatchEvent(new CustomEvent<PedidoCarpeta>(EVENTO_CARPETA, { detail: d }));
}

/**
 * Lee la respuesta de un guardado:
 *   · si el proyecto cambió de columna solo, lo dice (si no, la tarjeta
 *     "desaparece" de donde estabas mirando sin explicación);
 *   · si el nombre se propagó a la venta o al pedido, lo dice;
 *   · si ya sólo falta subir a Drive, abre el cuadro de entrega;
 *   · si lo renombrado tiene carpeta de REAPER, pregunta si se renombra.
 *
 * Llamarla ANTES de leer el cuerpo: saca su copia en ese mismo instante, y así
 * quien llamó puede seguir leyendo el suyo.
 */
export async function atenderRespuesta(r: Response): Promise<void> {
  try {
    const d = await r.clone().json();
    if (d?.estado) toast(`↪ El proyecto pasó a ${ESTADO_TXT[d.estado] ?? d.estado}`);
    if (Array.isArray(d?.sincronizado) && d.sincronizado.length) toast(`✓ También se renombró en ${d.sincronizado.join(" y ")}`);
    if (d?.entrega?.proyectoId) abrirEntrega(d.entrega as PedidoEntrega);
    if (d?.carpeta?.id) preguntarCarpeta(d.carpeta as PedidoCarpeta);
  } catch { /* sin cuerpo JSON: nada que hacer */ }
}
