-- ============================================================================
-- Acuerdo válido SOLO para una producción (2026-11-10)
-- ============================================================================
-- Un cliente pidió que su acuerdo aplique únicamente a la producción que se
-- cotizó, no a todas las de la misma familia. Hasta ahora la firma se guardaba
-- por (correo, familia, versión), así que una sola firma cubría todo lo futuro.
--
-- Lo que agrega:
--   1. cotizaciones.acuerdo_individual — interruptor por cotización. Apagado
--      (default) todo sigue como hoy: acuerdo por familia.
--   2. acuerdos_produccion — la firma de cada acuerdo individual, con copia
--      EXACTA del texto aceptado. Una fila por cotización. Es un registro legal:
--      si se borra la cotización, la fila se queda (folio guardado como texto).
--   3. proyectos.acuerdo_pendiente — la producción nace "esperando firma": el
--      anticipo SÍ se cobra, pero el trabajo no arranca (el portal de músicos no
--      les muestra el proyecto y el estudio no abre la sesión) hasta que el
--      cliente firme. Al firmar se apaga solo.
--
-- Los enlaces de firma del acuerdo individual se guardan en acuerdo_invitaciones
-- con familia = 'produccion' (no hace falta columna nueva): así ningún aviso del
-- acuerdo por familia los confunde con los suyos.
--
-- Correr en el SQL Editor de Supabase ANTES de desplegar. Idempotente.
-- ============================================================================

alter table public.cotizaciones
  add column if not exists acuerdo_individual boolean not null default false;

comment on column public.cotizaciones.acuerdo_individual is
  'true = el cliente firma un acuerdo válido solo para esta cotización (no el acuerdo por familia).';

create table if not exists public.acuerdos_produccion (
  id            uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references public.cotizaciones(id) on delete set null,
  -- El folio también como texto: la firma debe poder identificarse aunque la
  -- cotización se borre.
  folio         text not null,
  email         text not null,
  nombre        text not null,
  version       text not null,
  -- Copia EXACTA de lo que se le mostró y aceptó.
  texto         text not null,
  ip            text,
  user_agent    text,
  aceptado_at   timestamptz not null default now()
);

-- Una firma por cotización: firmar dos veces con el mismo enlace no duplica.
create unique index if not exists uq_acuerdos_produccion_cotizacion
  on public.acuerdos_produccion (cotizacion_id)
  where cotizacion_id is not null;

create index if not exists idx_acuerdos_produccion_email
  on public.acuerdos_produccion (email);

-- RLS sin policies: solo el service-role (las rutas del servidor) entra.
alter table public.acuerdos_produccion enable row level security;

comment on table public.acuerdos_produccion is
  'Firma del acuerdo individual de una producción. Una fila por cotización; guarda copia exacta del texto aceptado.';

alter table public.proyectos
  add column if not exists acuerdo_pendiente boolean not null default false;

comment on column public.proyectos.acuerdo_pendiente is
  'true = el cliente aún no firma el acuerdo individual: el anticipo se cobró pero la producción no puede arrancar.';

create index if not exists idx_proyectos_acuerdo_pendiente
  on public.proyectos (acuerdo_pendiente)
  where acuerdo_pendiente;
