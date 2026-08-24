import crypto from "node:crypto";

/**
 * Puente al backend del chatbot (Express en Railway, dueño de MongoDB).
 *
 * El panel admin vive en Vercel y el bot en Railway: son dos servicios. Este
 * módulo firma un JWT de vida corta con el MISMO `JWT_SECRET` del backend y lo
 * usa para hablarle. El secreto NUNCA sale del servidor — el navegador solo ve
 * las rutas `/api/admin/*` de Next, que ya validan sesión y rol.
 */

const BASE =
  process.env.CHAT_BACKEND_URL?.replace(/\/+$/, "") ||
  "https://arido-chat-backend-production.up.railway.app";

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Firma un JWT HS256 a mano (evita sumar `jsonwebtoken` solo para esto).
 * Payload igual al que emite el backend en /api/auth: { username, role }.
 */
function firmarToken(secret: string, minutos = 5): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const ahora = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({ username: "panel-admin", role: "admin", iat: ahora, exp: ahora + minutos * 60 }),
  );
  const firma = b64url(crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${firma}`;
}

export interface RespuestaBackend<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

/** Llama al backend del chatbot. Nunca lanza: devuelve el status para decidir arriba. */
export async function chatBackend<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<RespuestaBackend<T>> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { ok: false, status: 503, data: { error: "Falta JWT_SECRET: el puente al chatbot está apagado." } as T };
  }
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: init.method || "GET",
      headers: {
        Authorization: `Bearer ${firmarToken(secret)}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as T;
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return {
      ok: false,
      status: 502,
      data: { error: e instanceof Error ? e.message : "No se pudo contactar al chatbot" } as T,
    };
  }
}
