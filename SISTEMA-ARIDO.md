# Sistema ARIDO — Guía de activación (Fase A)

El código ya está desplegado. Cada pieza se activa cuando exista su llave en
Vercel. **Checklist para el dueño** (en orden):

## 1. Supabase (base de datos) — 5 min

1. Crea cuenta en https://supabase.com con latinogangbeats@gmail.com
2. New project → nombre `arido` → región `East US` (la más cercana) → genera
   una contraseña de base de datos y guárdala
3. Cuando cargue el proyecto: **SQL Editor → New query** → pega el contenido
   completo de `site/supabase-schema.sql` → **Run** (crea las tablas)
4. Ve a **Project Settings → API** y copia 2 valores a Vercel
   (https://vercel.com/latinogangbeats-2087s-projects/aridomusicgroup/settings/environment-variables):
   - `SUPABASE_URL` = Project URL (https://xxxx.supabase.co)
   - `SUPABASE_SERVICE_ROLE_KEY` = la key `service_role` (⚠️ la secreta, no la anon)

## 2. Resend (correos) — 5 min

1. Crea cuenta en https://resend.com con latinogangbeats@gmail.com (gratis,
   3,000 correos/mes)
2. **Domains → Add domain** → `aridomusicgroup.com`
3. Avísale a Claude en este punto: los registros DNS que te muestre Resend
   los configura él en Cloudflare
4. Cuando el dominio diga "Verified": **API Keys → Create** → copia a Vercel:
   - `RESEND_API_KEY` = `re_...`

## 3. Webhook de Stripe — 3 min

1. https://dashboard.stripe.com/webhooks → **Add endpoint**
2. Endpoint URL: `https://aridomusicgroup.com/api/stripe-webhook`
3. Events: selecciona solo `checkout.session.completed`
4. Crea el endpoint → en su página copia el **Signing secret** a Vercel:
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`

## 4. Redeploy

Avísale a Claude (o corre `npx vercel deploy --prod --yes` en `site/`).

## ¿Qué pasa cuando todo está activo?

En cada venta (beat o servicio), automáticamente:
1. El cliente queda registrado en la base de datos (email, nombre, teléfono)
2. El pedido se guarda con conceptos, total, nota y **origen** (Instagram,
   TikTok, Google, directo… vía UTM/referrer capturado en el sitio)
3. El cliente recibe **correo con marca LGB**: desglose, links de descarga
   (beats) o qué preparar (servicios)
4. Ustedes reciben aviso por correo con teléfono del cliente y link directo
   a su WhatsApp

## Variables de entorno (resumen)

| Variable | De dónde sale |
|---|---|
| `STRIPE_SECRET_KEY` | ✅ ya está |
| `NEXT_PUBLIC_DIRECT_CHECKOUT` | ✅ ya está |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → endpoint → Signing secret |
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (service_role) |
| `RESEND_API_KEY` | Resend → API Keys |

## Fase B — admin.aridomusicgroup.com ✅ DESPLEGADA

Panel de control en `admin.aridomusicgroup.com` (login con magic link, solo
correos en `ADMIN_EMAILS`):
- **Dashboard**: ventas del mes/totales, ticket promedio, gráfica 6 meses,
  desglose por producto y por origen (Instagram, TikTok, etc.)
- **Pedidos**: lista con pipeline de estados (nuevo → en producción → revisión
  → entregado), datos del cliente, botón WhatsApp directo
- **Finanzas**: ingresos automáticos de Stripe + captura de egresos (por
  categoría, ligables a pedido) + ingresos manuales (BeatStars, efectivo) →
  utilidad real. Todo unificado a MXN.
- **Clientes**: CRM que se llena solo con cada venta

### Pendiente de Fase B
- **SMTP de Resend para el magic link**: por defecto Supabase manda los correos
  de acceso con su propio servidor (límite bajo en plan free). Para que sea
  confiable, configurar SMTP de Resend en Supabase → Authentication → Emails.
- **Importar histórico**: meter los registros del Sheet "INGRESOS Y EGRESOS".

## Fases siguientes (pendientes)

- **C**: cuentas de cliente con magic link + "Mis compras"
- **D**: integrar el chat agent de IG al CRM
