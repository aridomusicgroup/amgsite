-- ============================================================================
-- Músico TITULAR por instrumento + quién toca en la cotización (2026-09-12)
-- ============================================================================
-- El catálogo tiene dos tololoches (Adal Oche, Angel Rocha) y dos trombones
-- (Jorge Orlando, Samuel Torres). La venta que se crea sola al pagarse una
-- cotización por Stripe no tenía a quién preguntarle, así que en esos dos
-- instrumentos no ponía a nadie (pasó con Alto Nivel, I0085).
--
-- Ahora: lo que se eligió en la cotización manda; si no se eligió, el titular.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.musicos add column if not exists titular boolean not null default false;

comment on column public.musicos.titular is
  'El que va por defecto en su instrumento cuando hay más de uno en el catálogo. Uno por instrumento (lo cuida la API).';

alter table public.cotizaciones add column if not exists musicos jsonb;

comment on column public.cotizaciones.musicos is
  'Quién toca cada instrumento: [{instrumento, musico_id}]. La venta automática (Stripe) y "Convertir en venta" lo toman de aquí.';

-- Titulares elegidos el 12-sep.
update public.musicos set titular = true where nombre in ('Jorge Orlando', 'Adal Oche');
