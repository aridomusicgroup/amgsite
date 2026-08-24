import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Autenticación ligera de clientes (aislada de Supabase Auth / admin).
 * Token firmado con HMAC-SHA256 → enlace mágico por correo.
 * Cookie de sesión firmada del mismo modo.
 */

const COOKIE = "cuenta_session";

function secret(): string {
  const s = process.env.CUSTOMER_SESSION_SECRET;
  if (!s) throw new Error("CUSTOMER_SESSION_SECRET no configurado");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Compara dos strings en tiempo constante (evita side-channel de timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Crea un token firmado email|exp (válido para el enlace mágico). */
export function makeToken(email: string, ttlMin = 30): string {
  const exp = Date.now() + ttlMin * 60_000;
  const payload = `${email.toLowerCase()}|${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/** Verifica un token y devuelve el email si es válido y no expiró. */
export function verifyToken(token: string): string | null {
  try {
    const [b64, sig] = token.split(".");
    if (!b64 || !sig) return null;
    const payload = Buffer.from(b64, "base64url").toString();
    if (!safeEqual(sign(payload), sig)) return null;
    const [email, expStr] = payload.split("|");
    if (Date.now() > Number(expStr)) return null;
    return email;
  } catch {
    return null;
  }
}

/** Cookie de sesión: email|exp firmado, 30 días. */
export function makeSession(email: string): string {
  const exp = Date.now() + 30 * 24 * 60 * 60_000;
  const payload = `${email.toLowerCase()}|${exp}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export const SESSION_COOKIE = COOKIE;

/** Lee el email del cliente autenticado desde la cookie, o null. */
export async function getCustomerEmail(): Promise<string | null> {
  try {
    const store = await cookies();
    const raw = store.get(COOKIE)?.value;
    if (!raw) return null;
    return verifyToken(raw); // mismo formato email|exp firmado
  } catch {
    return null;
  }
}

// ── Contraseña de cliente (scrypt) ─────────────────────────────────────────
const SCRYPT_KEYLEN = 64;

/** Hashea una contraseña → "saltHex:hashHex" (scrypt). */
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const dk = crypto.scryptSync(pw, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${dk.toString("hex")}`;
}

/** Verifica una contraseña contra el hash almacenado (timing-safe). */
export function verifyPassword(pw: string, stored: string): boolean {
  try {
    const [saltHex, hashHex] = String(stored || "").split(":");
    if (!saltHex || !hashHex) return false;
    const dk = crypto.scryptSync(pw, Buffer.from(saltHex, "hex"), SCRYPT_KEYLEN);
    const expected = Buffer.from(hashHex, "hex");
    return expected.length === dk.length && crypto.timingSafeEqual(expected, dk);
  } catch {
    return false;
  }
}
