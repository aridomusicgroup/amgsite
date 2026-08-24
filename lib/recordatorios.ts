// Recordatorios de tarea, uno por persona.
//
// Módulo PURO (sin `server-only`): el formateo lo usan igual el tablero en el
// navegador y el correo que arma el cron, y tienen que decir exactamente lo
// mismo. La lectura de datos vive en `recordatorios-server.ts`.

/** Lo que el tablero sabe de MI recordatorio en una tarea. */
export interface MiRecordatorio {
  /** ISO con zona (lo que guarda Postgres en timestamptz). */
  recordar_at: string;
  nota: string | null;
  enviado_at: string | null;
}

/** Tope: más allá de un año no es un recordatorio, es un error de dedo. */
export const MAX_DIAS_ADELANTE = 366;

/**
 * Valida la fecha/hora que llega del navegador. Se rechaza el pasado porque un
 * recordatorio vencido nunca se dispararía y quedaría ahí engañando al dueño:
 * lo vería puesto y nunca le llegaría nada.
 *
 * Margen de 1 minuto hacia atrás para no pelearse con el reloj del cliente.
 */
export function validarRecordar(iso: string, ahora = Date.now()): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Fecha u hora inválida.";
  if (t < ahora - 60_000) return "Esa fecha ya pasó. Elige una hacia adelante.";
  if (t > ahora + MAX_DIAS_ADELANTE * 86400000) return "Está demasiado lejos (máximo un año).";
  return null;
}

const TZ = "America/Mexico_City";

/**
 * "mar 5 ago, 9:00 a.m." — para el panel y para el correo.
 *
 * La zona va FIJA a la de la casa productora: el correo lo arma el cron en un
 * servidor de Vercel (UTC), así que sin esto diría una hora que no es la que la
 * persona eligió.
 */
export function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", timeZone: TZ,
  });
}

/** "9:00 a.m." */
export function soloHora(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    hour: "numeric", minute: "2-digit", timeZone: TZ,
  });
}

/**
 * ISO → el valor que espera `<input type="datetime-local">` ("2026-08-05T09:00").
 * El input NO acepta zona horaria, así que hay que darle la hora local ya hecha.
 */
export function paraInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Sugerencia por defecto al abrir el selector: mañana a las 9. */
export function sugerenciaInicial(ahora = new Date()): string {
  const d = new Date(ahora);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return paraInput(d.toISOString());
}

/** ¿Ya pasó la hora y sigue sin mandarse? (el cron corre cada 5 min) */
export const estaVencido = (r: MiRecordatorio, ahora = Date.now()): boolean =>
  !r.enviado_at && Date.parse(r.recordar_at) < ahora;
