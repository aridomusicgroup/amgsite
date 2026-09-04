/**
 * Piezas mínimas que comparten el tablero de Producción y la ventana de tarea.
 *
 * Viven aquí y no en ProduccionBoard para que `TareaModal` no tenga que
 * importar del archivo que a su vez lo importa: un ciclo de módulos que
 * funciona por accidente hasta que el orden de evaluación cambia.
 */

export const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red w-full";
export const lblS = "block text-[10px] text-white/40 mb-1";

export type Equipo = { id: string; nombre: string };
export type VentaLite = { id: string; label: string };
