import type { Familia } from "./familias";

export { FAMILIAS, FAMILIA_LABEL, FAMILIAS_PANEL, familiaDeProyecto, familiaDeVenta, familiasDeCliente, pendientes } from "./familias";
export type { Familia } from "./familias";
export { SEEDS } from "./seeds";
export type { AcuerdoSeed } from "./seeds";

/**
 * Versión vigente de cada acuerdo.
 *
 * Se sube A MANO cuando ESE acuerdo cambia de fondo, y eso vuelve a pedir la
 * aceptación — pero SOLO de esa familia: subir la de "personalizado" no
 * molesta a quien ya firmó "servicio". Editar el texto desde Plantillas NO
 * sube la versión (así se corrige una coma sin re-pedir firma a nadie); esto
 * se sube en el código cuando el cambio sí importa.
 */
export const ACUERDO_VERSIONES: Record<Familia, string> = {
  licencia: "2026-08",
  exclusiva: "2026-08",
  personalizado: "2026-08",
  servicio: "2026-08",
  ep_album: "2026-08",
};

/** Mete el nombre de quien acepta en el lugar del hueco. */
export function renderAcuerdo(texto: string, nombre: string): string {
  const quien = (nombre || "").trim() || "EL CLIENTE";
  return texto.replace(/\{\{cliente\}\}/g, quien);
}

/** Un nombre sirve como firma si de verdad parece un nombre. */
export function validarFirma(nombre: string): string | null {
  const n = (nombre || "").trim();
  if (n.length < 3) return "Escribe tu nombre completo para aceptar.";
  if (n.length > 120) return "Ese nombre es demasiado largo.";
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]{2}/.test(n)) return "Escribe tu nombre completo, tal como lo usas.";
  return null;
}
