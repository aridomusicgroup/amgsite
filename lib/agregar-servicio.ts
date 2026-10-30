/**
 * "Agregar servicio" a un proyecto que ya se entregó — lógica PURA.
 *
 * Del proyecto se salta al cotizador con el cliente, el proyecto de origen y el
 * servicio ya puestos, para no volver a capturar nada. Quien arma el enlace
 * (la ficha del proyecto) y quien lo lee (el cotizador) viven juntos aquí para
 * que no se desvíen.
 *
 * Los tipos se importan SOLO como tipo: este módulo lo prueba
 * `lib/agregar-servicio.test.mjs` con `node --test`, que no resuelve el alias `@/`.
 */
import type { Catalogo } from "./servicios";
import type { QuoteItem } from "./pdf/quote";

/** Id en `servicios_catalogo` / `data/services.json` (grupo "studio"). */
export const SERVICIO_MEZCLA_VOCES = "mezcla-voces";

/** Los servicios que el cotizador sabe precargar. La URL la escribe cualquiera: solo estos. */
const PRECARGABLES: readonly string[] = [SERVICIO_MEZCLA_VOCES];

export interface Precarga {
  servicio: string;
  /** Solo si el cliente existe en la lista del cotizador. */
  contactoId: string | null;
  /** Solo si el proyecto existe en la lista de proyectos ligables. */
  origenId: string | null;
}

/** El enlace de la ficha del proyecto al cotizador. */
export function urlAgregarServicio(servicio: string, proyecto: { id: string; contacto_id: string | null }): string {
  const q = new URLSearchParams({ nueva: servicio, origen: proyecto.id });
  if (proyecto.contacto_id) q.set("cliente", proyecto.contacto_id);
  return `/admin/cotizaciones?${q.toString()}`;
}

/**
 * Lo que pide la URL, ya validado contra lo que el cotizador conoce. Un cliente
 * o proyecto desconocido se descarta (la cotización se abre igual, sin él).
 */
export function precargaDeUrl(
  get: (clave: string) => string | null,
  existe: { cliente: (id: string) => boolean; proyecto: (id: string) => boolean },
): Precarga | null {
  const servicio = get("nueva");
  if (!servicio || !PRECARGABLES.includes(servicio)) return null;
  const cliente = get("cliente");
  const origen = get("origen");
  return {
    servicio,
    contactoId: cliente && existe.cliente(cliente) ? cliente : null,
    origenId: origen && existe.proyecto(origen) ? origen : null,
  };
}

/** Los conceptos con los que arranca la cotización: el servicio, a su precio de hoy. */
export function itemsDePrecarga(catalogo: Catalogo, precarga: Precarga | null): QuoteItem[] {
  if (!precarga) return [];
  const s = catalogo.studio.find((x) => x.id === precarga.servicio && x.activo);
  return s ? [{ label: s.label.es, qty: 1, unitPrice: s.price }] : [];
}
