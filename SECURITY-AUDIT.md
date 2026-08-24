# Auditoría de seguridad — ARIDO / Latino Gang Beats (`site/`)

**Fecha:** 2026-07-20
**Alcance:** revisión de código (estático) del panel admin, panel de cliente (`/cuenta`), endpoints públicos y machine-to-machine. Sin pruebas destructivas contra producción.
**Método:** lectura de código + mapa del grafo (`graphify`). Se priorizó el control de acceso, el aislamiento entre clientes (IDOR) y el uso del cliente service-role (`supabaseAdmin()`, el nodo más conectado del sistema).

> Este archivo es interno. NO publicar. Contiene detalle de la superficie de ataque.

## Resumen ejecutivo

No se encontró ninguna vulnerabilidad crítica de impacto inmediato en producción. La arquitectura de acceso está bien diseñada (RLS + lecturas solo server-side con service-role, roles en base de datos, IDOR cubierto, contraseñas con scrypt). Los hallazgos principales son:

- Una **cadena de toma de cuenta de cliente** vía inyección del header `Origin` en el enlace mágico (HIGH).
- **Reuso de una llave viva de Stripe** como secreto compartido de un endpoint (HIGH, ya conocido).
- **Rate limiting evadible** por diseño serverless + IP falsificable + Cloudflare en DNS-only (MEDIUM).
- Un **fallback de arranque** que puede otorgar admin si las envs no cargan (MEDIUM, defensa en profundidad).

| # | Severidad | Hallazgo | Estado |
|---|-----------|----------|--------|
| 1 | 🟠 HIGH | Enlace mágico construido con `Origin` del atacante → toma de cuenta | ✅ CORREGIDO 2026-07-20 |
| 2 | 🟠 HIGH | `BEATSTARS_EMAIL_SECRET` = llave live de Stripe (reuso de secreto) | ✅ CORREGIDO 2026-08-09 |
| 3 | 🟡 MEDIUM | Rate limiting evadible (in-memory + IP spoofable + sin WAF) | ✅ CORREGIDO 2026-08-09 |
| 4 | 🟡 MEDIUM | Fallback de arranque: sin env → cualquier usuario autenticado = admin | ✅ CORREGIDO 2026-07-20 |
| 5 | 🔵 LOW | Comparaciones de secreto/firma no constantes en tiempo | ✅ CORREGIDO 2026-07-20 |
| 6 | 🔵 LOW | PayPal webhook no exige `verified` (inofensivo hoy; peligroso en fase 2) | Abierto (antes de fase 2) |
| 7 | 🔵 LOW | Blindaje de bitácora depende de `entidad`; filas sin entidad o `titulo` sensible podrían filtrar | Abierto |
| 8 | 🔵 INFO | Sin separación de dominio entre token de enlace (30 min) y cookie de sesión (30 d) | Abierto |

---

## 🟠 HIGH

### 1. Enlace mágico construido con el header `Origin` (controlable por atacante) → toma de cuenta de cliente

**Archivo:** `app/api/cuenta/send-link/route.ts:32-33`

```ts
const origin = req.headers.get("origin") ?? "https://aridomusicgroup.com";
const link = `${origin}/cuenta/clave?token=${makeToken(clean)}`;
```

**Problema:** el `Origin` de una petición HTTP es controlable por el cliente (un `curl` puede enviar cualquier valor). El enlace de creación/restablecimiento de contraseña se arma con ese valor.

**Escenario de explotación:**
1. El atacante conoce (o adivina) el correo de un cliente real.
2. `POST /api/cuenta/send-link` con `{"email":"cliente@x.com"}` y header `Origin: https://evil.com`.
3. El cliente recibe un correo **legítimo** de LGB ("Crea tu contraseña") cuyo botón apunta a `https://evil.com/cuenta/clave?token=<TOKEN_VÁLIDO>`.
4. Si el cliente hace clic, `evil.com` captura el token (email|exp firmado, válido 30 min) y lo reproduce contra el sitio real para **fijar la contraseña de esa cuenta** → acceso a "Mi Cuenta" (contratos, beats, datos personales del cliente).

**Impacto:** toma de control de cuentas de cliente (requiere que el correo sea elegible y que la víctima haga clic en un dominio desconocido).

**Fix recomendado:** no confiar en el header; construir el enlace con un dominio fijo/allowlist (`DOMAINS` de `lib/site.ts`).

```ts
import { DOMAINS } from "@/lib/site";
const link = `${DOMAINS.main}/cuenta/clave?token=${makeToken(clean)}`;
```

Aplica el mismo patrón (menor impacto: solo afecta la sesión del propio atacante, la entrega es server-side) a `app/api/checkout/route.ts:102` y `app/api/checkout-services/route.ts:118`.

---

### 2. `BEATSTARS_EMAIL_SECRET` es la llave viva de Stripe (`sk_live_…`)

**Archivo:** `app/api/admin/beatstars-email/route.ts:100-104`

```ts
const secret = process.env.BEATSTARS_EMAIL_SECRET;
if (!secret) return NextResponse.json({ error: "No configurado" }, { status: 503 });
const b = await req.json().catch(() => ({}));
if (b.secret !== secret) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
```

**Problema:** el valor de `BEATSTARS_EMAIL_SECRET` está configurado (en Vercel) con la **clave secreta live de Stripe**. Esa clave de pagos ahora hace doble función como "secreto compartido" del endpoint de ingesta de correos de BeatStars, y por lo tanto:
- Está también almacenada en el Google Apps Script que reenvía los correos.
- Se compara en texto plano en cada request.
- Amplía la superficie de exposición de una llave que puede mover dinero real.

**Impacto:** si el Apps Script o la env se filtran, el atacante obtiene tu clave live de Stripe (cargos/reembolsos).

**Fix recomendado:**
1. Generar un secreto dedicado aleatorio: `openssl rand -hex 32`.
2. Ponerlo en Vercel como `BEATSTARS_EMAIL_SECRET` y en la constante `SECRET` del Apps Script.
3. **Rotar** la clave live de Stripe (por si ya quedó registrada en logs/historial).

---

## 🟡 MEDIUM

### 3. Rate limiting evadible y sin red de respaldo

**Archivo:** `lib/rate-limit.ts:8-16`

```ts
const hits = new Map<string, { count: number; reset: number }>();
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
```

**Problema (doble):**
1. El estado vive en un `Map` **en memoria por instancia serverless** → en Vercel cada instancia (y cada cold start) tiene su propio contador; no es un límite global.
2. La IP se toma de `cf-connecting-ip` / `x-forwarded-for`, **headers que el cliente puede falsificar**. Como Cloudflare está en **DNS-only (gris)**, no hay proxy arriba que sanee esos headers ni que aplique un rate-limit real. Rotando `cf-connecting-ip` en cada request, cada una cae en una key distinta → nunca se limita.

**Impacto:** los límites de `send-link` (spam de correos / abuso de Resend) y `checkout` son evadibles. Habilita también fuerza bruta si algún endpoint sensible dependiera de este límite.

**Fix recomendado:**
- Poner Cloudflare en modo **proxy (naranja)** y configurar **Rate Limiting Rules** + WAF (protección dura upstream).
- Y/o mover el límite a un store con estado compartido (Upstash Redis / Vercel KV).
- No confiar en `cf-connecting-ip` mientras Cloudflare no sea el proxy real.

---

### 4. Fallback de arranque: sin env, cualquier usuario autenticado se vuelve admin

**Archivo:** `lib/supabase/auth-server.ts:76-79`

```ts
let role: Role | null =
  admins.includes(email) ? "admin" : crm.includes(email) ? "crm" : prod.includes(email) ? "produccion" : null;
if (!role && admins.length === 0 && crm.length === 0 && prod.length === 0) role = "admin"; // arranque
```

**Problema:** si `ADMIN_EMAILS`, `CRM_EMAILS` y `PRODUCCION_EMAILS` están todas vacías y el correo no está en la tabla `usuarios`, se otorga rol **admin** total. En producción hoy `ADMIN_EMAILS` está configurada, así que no se dispara. Pero si esas envs alguna vez no cargan (deploy mal configurado, borrado accidental), cualquier correo capaz de crear sesión en Supabase Auth entraría como admin.

**Impacto:** riesgo latente de acceso admin total ante un fallo de configuración.

**Fix recomendado:** eliminar el fallback, o condicionarlo a una env explícita y de un solo uso (`BOOTSTRAP_ADMIN=<correo>`), de modo que la ausencia de configuración **niegue** el acceso en vez de concederlo.

---

## 🔵 LOW / INFO

### 5. Comparaciones no constantes en tiempo
- `app/api/admin/beatstars-email/route.ts:104` — `b.secret !== secret`.
- `lib/cuenta-auth.ts:34` — `sign(payload) !== sig` (firma HMAC del token de cliente).

Ambas comparan secretos con `!==` (no constante en tiempo). El side-channel de timing es poco práctico por red, pero el arreglo es trivial con `crypto.timingSafeEqual` sobre buffers de igual longitud (como ya se hace en `verifyPassword`).

### 6. PayPal webhook no exige verificación de firma
**Archivo:** `app/api/admin/paypal-webhook/route.ts:61-75`
Hoy es inofensivo: la fase 1 solo loguea y no crea ventas. Pero **antes de activar la fase 2** (creación de venta + comisión) hay que rechazar (`4xx`) todo evento con `verified === false`.

### 7. Blindaje de bitácora depende de `entidad`
**Archivo:** `app/api/admin/actividad/route.ts:31-39`
El filtro para no-admin excluye entidades sensibles vía `entidad.not.in.(...)` y permite `entidad.is.null`. Por lo tanto: una fila sensible con `entidad` nula (p.ej. registros viejos anteriores a la columna) o información sensible embebida en un `titulo` de entidad no-sensible podría ser visible para un miembro no-admin. Revisar/backfill de `entidad` en filas históricas y evitar datos sensibles en `titulo` de entidades no-sensibles.

### 8. Sin separación de dominio token vs cookie
**Archivo:** `lib/cuenta-auth.ts`
`makeToken` (enlace, 30 min) y `makeSession` (cookie, 30 días) usan el mismo formato `email|exp` y el mismo secreto, y ambos los verifica `verifyToken`. No es una vulnerabilidad directa (el `exp` embebido preserva la caducidad), pero conviene separar dominios (prefijo/propósito en el payload) para que un token no pueda usarse como el otro.

---

## ✅ Controles sólidos (verificados)

- **Validación de precios server-side** en `checkout` — el servidor recalcula el precio desde el catálogo; no confía en el cliente. Sin manipulación de precio.
- **`usuarios` es admin-only** (`getFullAdminEmail`) en POST/PATCH/DELETE, con candados anti-bloqueo (no quitarte tu propio admin, mínimo un admin activo). Sin escalada de privilegios.
- **RLS activo + lecturas solo con service-role server-side** — la anon key del navegador no lee ni escribe tablas sensibles.
- **IDOR cubierto** en `app/api/cuenta/contrato/pdf` — valida `cliente_email` y estado ≠ borrador antes de servir el PDF; `perfil` solo escribe el propio correo.
- **`send-link` es privacy-preserving** — responde OK siempre, solo envía a correos con compra/contrato.
- **Contraseñas con scrypt + `timingSafeEqual`** (`lib/cuenta-auth.ts`).
- **Ningún secreto ni service-role filtrado al bundle del cliente** — solo `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pública por diseño).
- **Consultas Supabase parametrizadas** — sin SQL injection; los filtros `.or()` usan constantes, no input de usuario.
- **Cabeceras de seguridad + CSP** configuradas en `next.config.ts` (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).

---

## Plan de remediación sugerido

**En código (hecho por Claude, 2026-07-20):**
- [x] #1 — dominio fijo (`DOMAINS`) en `send-link`, `checkout` y `checkout-services` (fuera el header `Origin`).
- [x] #5 — `timingSafeEqual` en `beatstars-email` (secreto) y en `verifyToken` (firma del token de cliente).
- [x] #4 — fallback de arranque endurecido: sin envs, solo entra un `BOOTSTRAP_ADMIN` explícito; en cualquier otro caso se niega.

**Configuración (lo hace el dueño):**
- [x] #2 — CORREGIDO 2026-08-09: secreto dedicado (`openssl rand -hex 32`) puesto en Vercel (`BEATSTARS_EMAIL_SECRET`) y en la constante `SECRET` del Google Apps Script; llave live de Stripe rotada en el dashboard de Stripe; redeploy confirmado y ambos endpoints (`beatstars-email`, `stripe-webhook`) verificados en vivo (401/400 sanos, sin 500/503).
- [x] #3 — CORREGIDO 2026-08-09: SSL/TLS pasado a **Full (strict)**; los 4 registros DNS que sirven tráfico (`aridomusicgroup.com`, `admin.`, `beats.`, `www.`) puestos en **Proxied** (nube naranja) — los de correo (MX/TXT: `send`, `_dmarc`, `resend._domainkey`) se dejaron en DNS-only a propósito, proxearlos rompe el correo. Regla de **Rate Limiting** creada (única disponible en el plan gratis): bloquea IPs que pasen de 5 peticiones / 10s contra `/api/cuenta/send-link`, `/api/checkout` o `/api/checkout-services`. Verificado en vivo: los 4 dominios siguen sirviendo contenido real tras el proxy (200/307 según corresponde), y una prueba de 7 peticiones seguidas a `send-link` sí disparó el bloqueo (429) sin afectar el resto del sitio.

**Antes de activar fases nuevas:**
- [ ] #6 — exigir `verified` en el webhook de PayPal antes de la fase 2.
- [ ] #7 — backfill de `entidad` y revisión de `titulo` sensibles en la bitácora.
