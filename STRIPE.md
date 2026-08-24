# Activar venta directa con Stripe

Estado actual: **código listo, falta pegar las claves** (solo el dueño debe manejarlas).

## Checklist de activación (5 minutos, lo haces tú)

1. **Stripe** → https://dashboard.stripe.com/apikeys
   - Copia la **Secret key** (`sk_live_...`).

2. **Vercel** → https://vercel.com/latinogangbeats-2087s-projects/aridomusicgroup/settings/environment-variables
   - Agrega: `STRIPE_SECRET_KEY` = `sk_live_...` (environment: Production)
   - Agrega: `NEXT_PUBLIC_DIRECT_CHECKOUT` = `1` (environment: Production)

3. **Google Drive** (cuenta latinogangbeats@gmail.com)
   - Clic derecho en la carpeta `BEATSTARS` → Compartir → Acceso general:
     **"Cualquier persona con el enlace" (Lector)**.
   - Sin esto, los compradores no podrán abrir sus links de descarga.

4. Avísale a Claude (o corre `npx vercel deploy --prod --yes` en `site/`) para
   redesplegar. Con eso el carrito cobra con Stripe.

## Cómo funciona la entrega automática

- Tras pagar, el cliente cae en `/beats/gracias?session_id=...`.
- El servidor verifica el pago con Stripe y muestra **botones de descarga**
  con la carpeta de Drive de cada beat comprado (`data/drive-links.json`).
- Si el beat no tiene carpeta mapeada, muestra "Por email en <24h" y tú lo
  envías manualmente (el pedido aparece en Stripe → Payments con el detalle).

## Pendientes conocidos

- **31 de 49 beats no tienen archivos en Drive** (no aparecen en la carpeta
  BEATSTARS): PARIS, OJOS ROJOS, YA NO, TU RECUERDO, NOS VA MEJOR, SOLO,
  ESTRELLAS, G-WAGON, etc. Sube sus carpetas a `BEATSTARS/` y pide a Claude
  re-mapear `data/drive-links.json`.
- La carpeta de cada beat contiene todos los archivos (MP3+WAV+stems); el
  comprador de licencia Basic también los vería. Si quieres separar por
  licencia, crea subcarpetas `MP3/`, `WAV/`, `STEMS/` por beat y se ajusta el
  código.
- Contrato de licencia en PDF por email: pendiente (Fase 3, requiere servicio
  de email tipo Resend).

## Mapeo actual

- `data/drive-links.json` — beatId → carpeta de Drive (18 beats mapeados)
- `data/drive-folders-raw.json` — todas las carpetas de BEATSTARS/ con sus IDs
