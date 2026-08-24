-- ============================================================================
-- Enlace público para firmar el acuerdo ANTES del anticipo (2026-08-07)
-- ============================================================================
-- Fase 3 del plan de acuerdos por familia (ver supabase-acuerdo-familias.sql).
-- Hasta ahora el acuerdo solo se pedía al entrar al panel — es decir, DESPUÉS
-- de que ya se cobró el anticipo y se empezó a trabajar. Para que el acuerdo
-- proteja de verdad, se manda un enlace al enviar la cotización de un servicio
-- a la medida (personalizado, servicio, EP/álbum) y se firma antes de pagar.
--
-- Por qué es un token público y no requiere sesión: muchos clientes cotizan
-- antes de tener cuenta en /cuenta (o antes de ponerse contraseña). El enlace
-- no necesita login — el token ES la autorización, igual que un enlace de
-- restablecer contraseña.
--
-- Al firmar, escribe en la MISMA tabla `cliente_acuerdos` (por email+familia),
-- así que si el cliente después entra a su panel con ese correo, ya lo
-- encuentra aceptado — no hay que firmarlo dos veces.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

create table if not exists public.acuerdo_invitaciones (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  email         text not null,
  familia       text not null,
  -- Contexto: de qué cotización nació el enlace. Se pone null si se borra la
  -- cotización; el enlace sigue siendo válido (el acuerdo no depende de ella).
  cotizacion_id uuid references public.cotizaciones(id) on delete set null,
  creado_por    text,
  creado_at     timestamptz not null default now(),
  expira_at     timestamptz not null,
  -- null = pendiente. Se sella al firmar; un enlace usado no se puede reusar.
  usado_at      timestamptz
);

create index if not exists idx_acuerdo_invitaciones_token
  on public.acuerdo_invitaciones (token);

create index if not exists idx_acuerdo_invitaciones_cotizacion
  on public.acuerdo_invitaciones (cotizacion_id);

-- RLS sin policies: solo el service-role (las rutas del servidor) entra. El
-- token en sí es la puerta, no una policy de Postgres.
alter table public.acuerdo_invitaciones enable row level security;

comment on table public.acuerdo_invitaciones is
  'Enlaces públicos para firmar un acuerdo antes del anticipo. Token = autorización, sin sesión.';
