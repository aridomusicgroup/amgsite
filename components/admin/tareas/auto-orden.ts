"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Acomodo automático de la lista de tareas: lo pendiente arriba, lo palomeado
 * abajo. Lo usan el Tablero de Producción y la pestaña Tareas del proyecto, que
 * pintan la MISMA lista y tienen que comportarse igual.
 *
 * Dos decisiones que valen la pena entender antes de tocar esto:
 *
 * 1. NUNCA se guarda. Es un acomodo de VISTA. El `orden` de la base es el que
 *    ve el cliente en su portal como línea de tiempo de la producción; hundir
 *    ahí lo terminado le reordenaría las etapas ("Mezcla" apareciendo después
 *    de "Grabación") cada vez que alguien palomea algo en el panel.
 *
 * 2. Mientras está encendido, arrastrar se apaga. Reordenar a mano contra un
 *    acomodo que se recalcula solo es pelearse con la pantalla: sueltas la
 *    tarea y salta de vuelta. El interruptor es la salida — se apaga y vuelve
 *    el arrastre de siempre.
 */

const KEY = "arido-tareas-auto-orden";

/**
 * Preferencia por navegador, encendida de fábrica.
 *
 * A propósito en localStorage y no en `user_prefs`: es una comodidad de vista,
 * no cambia ningún dato, y meterla en la base pediría una columna nueva — y una
 * columna que todavía no existe deja la pantalla en blanco hasta correr el SQL.
 */
export function useAutoOrden(): [boolean, (v: boolean) => void] {
  // Arranca en `true` igual en servidor y en cliente: leer localStorage aquí
  // rompería la hidratación. El valor guardado entra en el efecto.
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "0") setActivo(false);
    } catch { /* modo privado o cookies bloqueadas: se queda con el default */ }
  }, []);

  const cambiar = useCallback((v: boolean) => {
    setActivo(v);
    try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* no pasa nada */ }
  }, []);

  return [activo, cambiar];
}

/**
 * Pendientes primero, completadas después, respetando dentro de cada grupo el
 * orden manual que ya traían. `filter` dos veces (y no `sort`) porque es
 * estable por definición y no depende de cómo ordene el motor de turno.
 */
export function acomodarPendientesPrimero<T>(items: T[], hecho: (t: T) => boolean): T[] {
  return [...items.filter((t) => !hecho(t)), ...items.filter((t) => hecho(t))];
}
