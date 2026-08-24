-- ============================================================================
-- Fidelidad por pago completo (2026-08-07)
-- ============================================================================
-- Cualquier compra que el cliente paga DE UNA SOLA VEZ — licencia de BeatStars,
-- compra directa en la tienda, WhatsApp/Instagram registrado sin anticipo, o una
-- cotización marcada "de contado" — suma a su nivel de fidelidad. El nivel nunca
-- baja, ni aunque un crédito individual caduque sin usarse.
--
-- Arranca en CERO para todos, incluidos los clientes viejos: no se cuenta nada
-- retroactivo, solo lo que pase de aquí en adelante (decisión explícita del
-- 2026-08-07 — "los que ya estaban así, que empiecen a contar en sus compras
-- futuras").
--
-- Dos capas separadas a propósito:
--   1. Contador permanente en `contactos` — nunca se resetea, decide el % de
--      descuento en su PRÓXIMA cotización de contado (lib/fidelidad.ts).
--   2. `creditos_cliente` — saldo GASTABLE con vencimiento, aparte del nivel.
--      Perder un crédito viejo no le baja el nivel.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.contactos
  add column if not exists pagos_contado_total integer not null default 0,
  add column if not exists monto_contado_historico numeric not null default 0;

comment on column public.contactos.pagos_contado_total is
  'Cuántas compras ha pagado de una sola vez, de por vida. Nunca baja. Decide el nivel de fidelidad.';
comment on column public.contactos.monto_contado_historico is
  'Cuánto ha pagado así, de por vida, en pesos. Solo para reporte — el nivel lo decide el conteo, no el monto.';

create table if not exists public.creditos_cliente (
  id                     uuid primary key default gen_random_uuid(),
  contacto_id            uuid not null references public.contactos(id) on delete cascade,
  -- De qué compra nació este crédito (venta o cotización, nunca ambas).
  origen_venta_id        uuid references public.ventas(id) on delete set null,
  origen_cotizacion_id   uuid references public.cotizaciones(id) on delete set null,
  monto                  numeric not null,
  motivo                 text,
  expira_at              timestamptz not null,
  -- null = disponible. Se sella al aplicarlo a una cotización futura.
  usado_en_cotizacion_id uuid references public.cotizaciones(id) on delete set null,
  usado_at               timestamptz,
  creado_at              timestamptz not null default now()
);

create index if not exists idx_creditos_cliente_contacto
  on public.creditos_cliente (contacto_id)
  where usado_at is null;

alter table public.creditos_cliente enable row level security;

comment on table public.creditos_cliente is
  'Saldo gastable por pagar de contado. Vence si no se usa. Independiente del nivel permanente en contactos.';

-- La cotización necesita saber CUÁNTO descuento de fidelidad se aplicó (se
-- calcula y se congela al guardar/enviar, igual que el total — una cotización
-- ya enviada no debe cambiar de precio sola si el cliente sube de nivel después).
alter table public.cotizaciones
  add column if not exists descuento_fidelidad numeric not null default 0,
  add column if not exists credito_aplicado numeric not null default 0;

comment on column public.cotizaciones.descuento_fidelidad is
  'Descuento por nivel de fidelidad, congelado al guardar. No se recalcula después.';
comment on column public.cotizaciones.credito_aplicado is
  'Cuánto de su saldo gastable (creditos_cliente) se aplicó a esta cotización.';
