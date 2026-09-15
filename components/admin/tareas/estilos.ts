/**
 * Piezas mínimas que comparten el tablero de Producción y la ventana de tarea.
 *
 * Viven aquí y no en ProduccionBoard para que `TareaModal` no tenga que
 * importar del archivo que a su vez lo importa: un ciclo de módulos que
 * funciona por accidente hasta que el orden de evaluación cambia.
 */

// `min-h-9`: un <select> y un <input> con el mismo padding no miden lo mismo;
// sin esto el de compás quedaba más bajito que sus vecinos de la misma fila.
// (min y no h: `inp` también viste textareas.)
export const inp = "bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 min-h-9 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-lgb-red w-full";
// 11px y medio peso: a 10px/40% la etiqueta se perdía junto a un campo de 14px.
export const lblS = "block text-[11px] font-medium text-white/55 mb-1.5";

export type Equipo = { id: string; nombre: string };
export type VentaLite = { id: string; label: string };
