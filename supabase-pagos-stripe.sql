-- Cobranza: poder cobrar el SALDO de una venta con un link de Stripe.
--
-- El link que ya existía (`/api/admin/cotizaciones/[id]/link-pago`) cobra el
-- siguiente TRAMO de la cotización según `cotizacion_pagos`, que solo tiene
-- pagos confirmados por Stripe. Los clientes que deben pagaron su anticipo por
-- transferencia o efectivo —eso vive en `pagos`— así que para ellos
-- `cotizacion_pagos` está vacío y ese link les volvería a cobrar el ANTICIPO,
-- no su saldo. Medido: los 10 deudores tienen `cotizacion_pagos` en cero.
--
-- De ahí el link nuevo, armado sobre `total_mxn − Σ pagos` de la venta. Y de
-- ahí esta columna: Stripe reintenta los webhooks, y sin una llave única el
-- mismo pago se acreditaría dos veces. Mismo criterio que
-- `cotizacion_pagos.stripe_session_id`.
alter table pagos add column if not exists stripe_session_id text;

-- Único pero NULLABLE: los pagos capturados a mano (efectivo, transferencia)
-- no tienen sesión de Stripe, y en Postgres los NULL no chocan entre sí.
create unique index if not exists pagos_stripe_session_id_idx
  on pagos (stripe_session_id)
  where stripe_session_id is not null;
