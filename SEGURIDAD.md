# Seguridad — Sistema ARIDO

## ✅ Ya implementado en el código (2026-06-12)

| Protección | Estado |
|---|---|
| **Base de datos (RLS)** | Probado: la llave pública NO puede leer ni escribir ninguna tabla. Solo el servidor (service_role) accede. |
| **Inyección SQL** | Nula: todas las consultas usan métodos parametrizados de Supabase (`.eq`, `.insert`), cero SQL crudo. |
| **XSS** | Sin vectores: no se renderiza HTML de usuario; los únicos `dangerouslySetInnerHTML` son JSON estático (SEO). |
| **Secretos** | Todos en variables de entorno de Vercel (cifradas). Cero secretos en el código. `.gitignore` ignora `.env*`. |
| **Cabeceras HTTP** | CSP, HSTS (2 años), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. `X-Powered-By` oculto. |
| **Auth admin** | Magic link + lista blanca de correos (`ADMIN_EMAILS`). Rutas y APIs `/admin/*` rechazan sin sesión (401/redirect). |
| **Auth cliente** | Token HMAC firmado, cookie httpOnly+secure, aislado del admin. |
| **Rate limiting** | Envío de correos (5/10min por IP) y checkouts (15/min por IP). |
| **Webhook Stripe** | Verificación de firma obligatoria. |
| **Validación de pagos** | Precios SIEMPRE validados en el servidor contra los datos; nunca se confía en el cliente. |

## 🔴 PENDIENTE — solo tú puedes hacerlo (CRÍTICO)

### 1. Activar verificación en dos pasos (2FA) en TODAS las cuentas
Lo más importante. Si una cuenta cae, caen las demás. En orden de prioridad:
- [ ] **Google** (latinogangbeats@gmail.com) — es la cuenta maestra, recupera a todas las demás. 2FA + llave/código de respaldo.
- [ ] **Stripe** (el dinero) — 2FA obligatorio.
- [ ] **Vercel**, **Cloudflare**, **Supabase**, **Resend**, **GitHub** — 2FA en cada una.

### 2. Rotar las llaves que se compartieron por el chat
Por seguridad, regenéralas (toma ~10 min) y vuelve a ponerlas en Vercel:
- [ ] **Supabase service_role** → Settings → API Keys → rotar secret → actualizar `SUPABASE_SERVICE_ROLE_KEY`
- [ ] **Resend API key** → resend.com/api-keys → borrar y crear nueva → `RESEND_API_KEY`
- [ ] **Stripe webhook secret** → Webhooks → roll secret → `STRIPE_WEBHOOK_SECRET`
- [ ] **Customer session secret** → me dices y genero uno nuevo
*(La `STRIPE_SECRET_KEY` no se compartió completa; rotarla es opcional.)*

### 3. Cloudflare (puedo hacerlo contigo)
- [ ] SSL/TLS → modo **Full (strict)**
- [ ] **Always Use HTTPS** activado
- [ ] **Bot Fight Mode** activado (Security → Bots)
- [ ] Security Level → **Medium** o **High**
- [ ] 1 regla de **Rate Limiting** (plan free incluye una) en `/api/*`
- [ ] (Opcional) Regla de firewall que rete (challenge) accesos a `admin.aridomusicgroup.com`

### 4. Buenas prácticas continuas
- [ ] Nunca pegar llaves secretas en chats, correos o capturas.
- [ ] Si subes el código a GitHub, que el repo sea **privado** y activa **secret scanning**.
- [ ] Revisar `npm audit` cada cierto tiempo (hoy: 2 moderadas en postcss, solo build, sin riesgo real).
- [ ] En Stripe, activar **Radar** (detección de fraude, gratis en el plan estándar).
