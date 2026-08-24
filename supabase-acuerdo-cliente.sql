-- ============================================================================
-- Aceptación del acuerdo marco por parte del CLIENTE (2026-08-05)
-- ============================================================================
-- SUPERADO por supabase-acuerdo-familias.sql (2026-08-07): el acuerdo único
-- se volvió uno POR FAMILIA de servicio (licencia/exclusiva/personalizado/
-- servicio/ep_album) — un beat personalizado y un EP no comparten cláusulas.
-- Sigue corriéndose primero porque crea la tabla; el otro archivo solo le
-- agrega la columna `familia` encima. Correr los dos, en este orden.
--
-- Al entrar a su panel (/cuenta), el cliente ve el acuerdo de prestación de
-- servicios y no puede usar el panel hasta aceptarlo.
--
-- Por qué se guarda el TEXTO COMPLETO y no solo un "sí, aceptó":
-- el texto es editable desde Plantillas. Si mañana se cambia una cláusula y
-- solo guardáramos la fecha, sería imposible saber qué aceptó cada quien. Lo
-- firmado tiene que quedar congelado, aunque la plantilla cambie después.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

create table if not exists public.cliente_acuerdos (
  id           uuid primary key default gen_random_uuid(),
  -- Correo de la sesión del cliente. Nunca viene del navegador.
  email        text not null,
  -- Versión del acuerdo. Se sube a mano en el código cuando cambia de fondo, y
  -- eso vuelve a pedir la aceptación.
  version      text not null,
  -- Nombre que escribió como firma, y copia EXACTA de lo que se le mostró.
  nombre       text,
  texto        text not null,
  -- Rastro mínimo de la aceptación, por si alguna vez se discute.
  ip           text,
  user_agent   text,
  aceptado_at  timestamptz not null default now()
);

-- Una aceptación por persona por versión: volver a entrar no acumula filas.
create unique index if not exists uq_cliente_acuerdo_version
  on public.cliente_acuerdos (email, version);

create index if not exists idx_cliente_acuerdos_email
  on public.cliente_acuerdos (email);

-- RLS sin policies: solo el service-role (las rutas del servidor) entra.
alter table public.cliente_acuerdos enable row level security;

comment on table public.cliente_acuerdos is
  'Aceptación del acuerdo marco por cliente. Guarda copia literal del texto aceptado.';
