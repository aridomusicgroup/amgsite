import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Enlace de pago del saldo que NO caduca.
 *
 * Un link de Stripe Checkout vive 24 horas. Si el correo de "tu producción ya
 * está lista" trajera el link directo, el cliente que lo abre al segundo día se
 * encontraría una página muerta — justo el cliente que ya decidió pagar.
 *
 * Así que el correo lleva un enlace del sitio, firmado, y el cobro se arma en el
 * momento del clic (`/api/pagar-saldo/[token]`), siempre por el saldo de ese
 * instante. Tampoco pide iniciar sesión: quien tiene el correo puede pagar.
 *
 * La firma es un HMAC del id de la venta. Sólo sirve para PAGAR el saldo de esa
 * venta, que es inofensivo; no abre nada más.
 */
const clave = (): string | null => {
  const k = process.env.STRIPE_SECRET_KEY;
  return k ? `arido-pago-saldo:${k}` : null;
};

const firma = (ventaId: string, k: string) =>
  createHmac("sha256", k).update(ventaId).digest("base64url").slice(0, 32);

export function tokenDePago(ventaId: string): string | null {
  const k = clave();
  return k ? `${ventaId}.${firma(ventaId, k)}` : null;
}

export function ventaDeToken(token: string): string | null {
  const k = clave();
  const [ventaId, f] = String(token || "").split(".");
  if (!k || !ventaId || !f || !/^[0-9a-f-]{36}$/i.test(ventaId)) return null;
  const esperada = Buffer.from(firma(ventaId, k));
  const recibida = Buffer.from(f);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  return ventaId;
}
