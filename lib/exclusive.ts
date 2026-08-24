import legacyBeats from "@/data/legacy-beats.json";

/**
 * Regla de licencia exclusiva:
 *  - Beats "legacy" (los que ya existían): la exclusiva se NEGOCIA → botón a BeatStars.
 *  - Beats nuevos (subidos de aquí en adelante, no listados en legacy-beats.json):
 *    la exclusiva es COMPRA DIRECTA por Stripe a EXCLUSIVE_DIRECT_PRICE, con contrato automático.
 *
 * Así, cada beat nuevo queda con checkout directo sin tener que marcarlo a mano.
 */

export const EXCLUSIVE_DIRECT_PRICE = 600;

const legacy = new Set(legacyBeats as string[]);

/** ¿Este beat vende la exclusiva como compra directa por Stripe? (= es un beat nuevo) */
export function isDirectExclusive(beatId: string): boolean {
  return !legacy.has(beatId);
}
