import { NextRequest } from "next/server";

/**
 * Rate limit ligero en memoria (best-effort por instancia serverless).
 * Para protección dura usar también las reglas de Cloudflare (WAF / Rate Limiting).
 * Suficiente para frenar abuso básico de endpoints (spam de correos, fuerza bruta).
 */
const hits = new Map<string, { count: number; reset: number }>();

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * @returns true si la petición está permitida, false si excedió el límite.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    // Limpieza ocasional para no crecer sin límite
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    }
    return true;
  }

  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
