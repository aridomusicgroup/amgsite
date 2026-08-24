-- Fase B del plan de pagos: ledger de pagos de Stripe recibidos contra una
-- cotización, ANTES de que exista una venta. Cada tramo (según lib/esquema-pago.ts)
-- se paga con su propio link de Stripe; esta tabla solo guarda los que YA se
-- confirmaron (checkout.session.completed) — un link generado y sin pagar no
-- deja rastro aquí.
create table if not exists cotizacion_pagos (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  tramo_index int not null,
  tramo_label text,
  monto numeric not null default 0,
  moneda text not null default 'MXN',
  stripe_session_id text unique not null,
  pagado_at timestamptz not null default now(),
  creado_at timestamptz not null default now()
);

create index if not exists cotizacion_pagos_cotizacion_id_idx on cotizacion_pagos (cotizacion_id);

-- Mismo patrón que el resto del esquema: RLS encendido, sin políticas — solo
-- la service-role key (usada siempre desde el servidor) puede tocar esta tabla.
alter table cotizacion_pagos enable row level security;
