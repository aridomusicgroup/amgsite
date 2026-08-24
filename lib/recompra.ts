// Regla de recompra: quién ya compró, ya se le entregó, y toca ofrecerle lo
// siguiente. Es la palanca de recurrencia — solo ~9% de los clientes repiten.
//
// El reloj arranca en la ÚLTIMA VENTA, no en la entrega del proyecto: casi
// todas las ventas del negocio (BeatStars, WhatsApp) nunca pasan por el tablero
// de Producción, así que anclarlo a `fecha_entrega_real` dejaría fuera a la
// mayoría de los clientes reales.
//
// Módulo PURO: lo usan igual el panel (navegador) y el cron (servidor).
import type { Contacto } from "./erp-data";

/** Antes de un mes todavía está caliente el proyecto: no se le ofrece nada. */
export const DIAS_MIN = 30;
/** Hasta aquí sigue tibio: es la ventana donde la recompra cierra más fácil. */
export const DIAS_TIBIO = 60;
/** Más allá de un año ya no es recompra, es reactivación fría. */
export const DIAS_MAX = 365;
/** Tras escribirle, a los cuántos días toca revisar si contestó. */
export const DIAS_REVISION = 3;

export type Temperatura = "tibio" | "frio" | "dormido";

export interface Candidato {
  c: Contacto;
  /** Días desde su última compra. */
  dias: number;
  temperatura: Temperatura;
  /** Borrador editable del mensaje. */
  mensaje: string;
  /** Marca única de este ciclo: si vuelve a comprar, se re-arma solo. */
  clave: string;
}

export const TEMP_LABEL: Record<Temperatura, string> = {
  tibio: "Listo para lo siguiente",
  frio: "Se está enfriando",
  dormido: "Dormido",
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

export const diasDesde = (fecha: string, hoy = hoyISO()): number =>
  Math.floor(
    (new Date(hoy + "T12:00:00").getTime() - new Date(fecha + "T12:00:00").getTime()) / 86400000,
  );

const temperaturaDe = (dias: number): Temperatura =>
  dias <= DIAS_TIBIO ? "tibio" : dias <= 120 ? "frio" : "dormido";

/**
 * Identificador del ciclo de recompra, anclado a la fecha de la última compra.
 * Se guarda en `interacciones.external_id` (índice único) para que programar u
 * omitir sea idempotente. Una compra nueva ⇒ ancla nueva ⇒ ciclo nuevo.
 */
export const claveRecompra = (contactoId: string, ultimaCompra: string): string =>
  `recompra:${contactoId}:${ultimaCompra}`;

export const primerNombre = (n: string | null): string => {
  const p = (n ?? "").trim().split(/\s+/)[0] ?? "";
  // Nombres tipo "🅹 🅲🆁🅾🆆🅽" o vacíos: mejor no usar nada que saludar raro.
  return /[a-záéíóúñ]/i.test(p) ? p : "";
};

/** Número listo para wa.me: solo dígitos, con lada de México si viene a 10. */
export function telWhatsapp(tel: string | null): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length === 10) return `52${d}`;
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

/**
 * Borrador del mensaje. Se separa por tamaño de ticket porque no se le habla
 * igual a quien pagó una licencia de $800 que a quien pagó un EP de $15,000.
 */
export function mensajeRecompra(c: Contacto, dias: number): string {
  const nom = primerNombre(c.nombre);
  const hola = nom ? `Qué onda ${nom}` : "Qué onda";
  const que = c.ultimaCompraConcepto ? `“${c.ultimaCompraConcepto}”` : "lo último que hicimos";
  const meses = Math.round(dias / 30);
  const hace = meses <= 1 ? "un mes" : `como ${meses} meses`;

  if (dias > 120) {
    return `${hola}, ¿cómo andas? Hace rato que no sabemos de ti por acá. ` +
      `La última vez hicimos ${que} y desde entonces le hemos subido mucho al nivel del estudio. ` +
      `Si traes algo entre manos, avísame y te armo precio de cliente.`;
  }

  if (c.ltv >= 5000) {
    return `${hola}, ¿cómo va todo? Ya pasó ${hace} desde que te entregamos ${que}. ` +
      `¿Cómo te ha ido con el tema? Si ya andas pensando en el siguiente, ` +
      `todavía tengo espacio en agenda este mes y te lo aparto.`;
  }

  return `${hola}, ¿qué tal? ¿Cómo te fue con ${que}? ` +
    `Si ya lo sacaste pásame el link y lo movemos desde nuestras cuentas. ` +
    `Y si andas armando el siguiente, tengo beats nuevos que te van a latir — te paso el pack cuando quieras.`;
}

/** Etapas que ya no se persiguen para recompra. */
const ETAPAS_FUERA = ["perdido"];

/**
 * Clientes a los que toca ofrecerles lo siguiente, ordenados por lo que han
 * dejado (primero los que más valen).
 *
 * Se excluye a quien:
 *  - no tiene compras o compró hace menos de {@link DIAS_MIN} días,
 *  - **todavía tiene un proyecto abierto** (si le debemos trabajo, no es momento
 *    de venderle lo siguiente). Cuenta como abierto todo lo que no esté
 *    entregado, cerrado o cancelado.
 *  - ya trae un seguimiento abierto (ya está en la lista de trabajo),
 *  - ya se atendió u omitió en ESTE ciclo (`marcas`),
 *  - está marcado como perdido.
 */
export function candidatosRecompra(
  contactos: Contacto[],
  marcas: Set<string> = new Set(),
  hoy = hoyISO(),
): Candidato[] {
  const out: Candidato[] = [];
  for (const c of contactos) {
    if (!c.ultimaCompra) continue;
    if (c.proyectosAbiertos > 0) continue;
    if (c.proximaAccion || c.proximaFecha) continue;
    if (ETAPAS_FUERA.includes(c.etapa)) continue;

    const dias = diasDesde(c.ultimaCompra, hoy);
    if (dias < DIAS_MIN || dias > DIAS_MAX) continue;

    const clave = claveRecompra(c.id, c.ultimaCompra);
    if (marcas.has(clave)) continue;

    out.push({ c, dias, temperatura: temperaturaDe(dias), mensaje: mensajeRecompra(c, dias), clave });
  }
  return out.sort((a, b) => b.c.ltv - a.c.ltv || a.dias - b.dias);
}
