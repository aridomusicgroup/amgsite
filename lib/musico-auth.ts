import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Sesión del portal de músicos (/musico).
 *
 * Es un tercer sistema de acceso, aparte del panel (Supabase Auth) y del portal
 * de clientes (lib/cuenta-auth.ts). Comparte la MECÁNICA con el de clientes
 * —HMAC-SHA256, comparación en tiempo constante, cookie httpOnly— pero nada más.
 *
 * Por qué no se reusa `cuenta-auth`: su payload es `email|exp` y no dice de qué
 * portal es. Si los dos firmaran con el mismo secreto, la cookie de un músico
 * abriría /cuenta como cliente con ese correo, y la de un cliente abriría
 * /musico. Por eso aquí: cookie propia, secreto propio, y el payload lleva el
 * ID del músico (no su correo) — así un correo repetido entre un cliente y un
 * músico tampoco cruza nada.
 */

const COOKIE = "musico_session";
const DIAS = 30;
const TTL_TOKEN_MIN = 30;

function secret(): string {
  const s = process.env.MUSICO_SESSION_SECRET;
  if (!s) throw new Error("MUSICO_SESSION_SECRET no configurado");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Compara en tiempo constante (evita filtrar la firma por el tiempo de respuesta). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function armar(musicoId: string, expMs: number): string {
  const payload = `${musicoId}|${expMs}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function abrir(valor: string): string | null {
  try {
    const [b64, sig] = valor.split(".");
    if (!b64 || !sig) return null;
    const payload = Buffer.from(b64, "base64url").toString();
    if (!safeEqual(sign(payload), sig)) return null;
    const [musicoId, expStr] = payload.split("|");
    if (!musicoId || Date.now() > Number(expStr)) return null;
    return musicoId;
  } catch {
    return null;
  }
}

/** Enlace de entrada por correo: vale 30 minutos. */
export function makeTokenMusico(musicoId: string, ttlMin = TTL_TOKEN_MIN): string {
  return armar(musicoId, Date.now() + ttlMin * 60_000);
}

/** Verifica el token del enlace y devuelve el id del músico. */
export function verifyTokenMusico(token: string): string | null {
  return abrir(token);
}

/** Cookie de sesión, 30 días. */
export function makeSessionMusico(musicoId: string): string {
  return armar(musicoId, Date.now() + DIAS * 24 * 60 * 60_000);
}

export const MUSICO_COOKIE = COOKIE;
export const MUSICO_MAX_AGE = DIAS * 24 * 60 * 60;

/**
 * El id del músico con sesión abierta, o null.
 *
 * Es el `getCustomerEmail()` de este portal: toda página y toda ruta del portal
 * arranca con esto. Devuelve solo el id — que el músico siga teniendo portal
 * (`portal_activo`) se comprueba al leer sus datos, para que apagarle el
 * interruptor lo saque aunque su cookie siga viva.
 */
export async function getMusicoId(): Promise<string | null> {
  try {
    const store = await cookies();
    const raw = store.get(COOKIE)?.value;
    if (!raw) return null;
    return abrir(raw);
  } catch {
    return null;
  }
}
