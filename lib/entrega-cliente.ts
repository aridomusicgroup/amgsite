/**
 * El puente entre "palomeé una tarea" y "se abre el cuadro de entrega".
 *
 * Las palomitas viven en tres lugares (tablero, pestaña Tareas y la ventana de
 * la tarea) y el cuadro vive en uno solo (`EntregaLanzador`, montado una vez en
 * el menú). En vez de pasar callbacks por tres árboles distintos, quien palomea
 * lanza un evento y el lanzador lo escucha.
 */
export const EVENTO_ENTREGA = "arido:entrega";

export interface PedidoEntrega {
  proyectoId: string;
  tareaId: string | null;
  titulo?: string;
}

export function abrirEntrega(d: PedidoEntrega): void {
  window.dispatchEvent(new CustomEvent<PedidoEntrega>(EVENTO_ENTREGA, { detail: d }));
}

/**
 * Lee la respuesta del palomeo: si el servidor dice que ya sólo falta subir a
 * Drive, abre el cuadro. Usa una copia de la respuesta para no consumir el
 * cuerpo que quizá lea quien llamó.
 */
export async function avisarSiEntrega(r: Response): Promise<void> {
  try {
    const d = await r.clone().json();
    if (d?.entrega?.proyectoId) abrirEntrega(d.entrega as PedidoEntrega);
  } catch { /* sin cuerpo JSON: nada que abrir */ }
}
