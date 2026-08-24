-- ═══════════════════════════════════════════════════════════════════════════
-- Otros ingresos: dinero SIN cliente (YouTube, streaming, payouts de BeatStars,
-- sync/licencias, etc.). Separado de `ventas` (que va atado al CRM/LTV).
-- Cae en las finanzas y el reparto trimestral igual que las ventas.
-- Correr en el SQL Editor de Supabase. Aditivo e idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ingresos (
  id          uuid primary key default gen_random_uuid(),
  folio       text unique,                       -- OI0001…
  fecha       date not null,
  fuente      text,                              -- YouTube, Streaming, BeatStars, Sync, Otro
  concepto    text,
  moneda      text not null default 'MXN',
  monto_mxn   numeric(12,2) not null,            -- lo que entra, normalizado a pesos
  recurrente  boolean default false,             -- llega cada mes (YouTube, etc.)
  nota        text,
  creado_por  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_ingresos_fecha  on public.ingresos(fecha desc);
create index if not exists idx_ingresos_fuente on public.ingresos(fuente);

alter table public.ingresos enable row level security;
