-- Comisión REAL que Stripe descuenta por cada cobro (exacta, sacada de
-- balance_transaction.fee en el webhook — no una estimación como la de
-- PayPal). Dos lugares porque una venta puede cobrarse de un solo golpe
-- (checkout directo → va en `ventas`) o en varios tramos vía cotización
-- (cada tramo es su propio cargo de Stripe con su propia comisión → va en
-- `pagos`, uno por tramo). NULL = no aplica (no es un cobro de Stripe) o no
-- se pudo obtener el dato (best-effort, nunca bloquea el registro del pago).
alter table public.ventas add column if not exists comision_stripe_mxn numeric;
alter table public.pagos add column if not exists comision_stripe_mxn numeric;

comment on column public.ventas.comision_stripe_mxn is
  'Comisión real de Stripe (balance_transaction.fee) para ventas cobradas de un solo golpe por checkout directo, en MXN.';
comment on column public.pagos.comision_stripe_mxn is
  'Comisión real de Stripe (balance_transaction.fee) de ESTE tramo/cargo, en MXN.';

-- Además de guardar el monto en ventas/pagos (para el "neto" rápido en la
-- tarjeta de la venta), cada comisión se registra como un Egreso real —
-- mismo trato contable que la comisión de BeatStars (folio BSC-…): así
-- aparece en el libro de Egresos, es buscable/filtrable, y entra al cálculo
-- de gastos operativos por el camino normal (sin lógica especial).
alter table public.egresos add column if not exists venta_id uuid references public.ventas(id) on delete set null;
create index if not exists idx_egresos_venta on public.egresos(venta_id);
comment on column public.egresos.venta_id is
  'Venta de origen para egresos auto-generados (comisión de Stripe) — NULL para egresos capturados a mano.';
