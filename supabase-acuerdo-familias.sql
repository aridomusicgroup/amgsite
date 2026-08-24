-- ============================================================================
-- Acuerdos POR FAMILIA de servicio (2026-08-07)
-- ============================================================================
-- Un solo acuerdo no sirve para todo: el que compra una licencia de $834 ya
-- entregada no debe firmar un anticipo del 50% que nunca le aplicó, y un EP de
-- tres meses necesita cláusulas (calendario, coautoría) que un beat suelto no.
--
-- `cliente_acuerdos` pasa de "un acuerdo general" a "un acuerdo por familia".
-- 0 filas en la tabla al momento de esta migración (verificado 2026-08-05), así
-- que no hay nada que migrar — solo se agrega la columna y se cambia el índice.
--
-- Familias: licencia | exclusiva | personalizado | servicio | ep_album
-- (ver lib/acuerdos/familias.ts, que es la fuente de verdad de los valores).
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.cliente_acuerdos
  add column if not exists familia text;

-- Todo lo que ya existiera (no debería haber nada) se cuenta como del acuerdo
-- general viejo, para no perder el registro si algún día sí hubo filas.
update public.cliente_acuerdos set familia = 'general' where familia is null;

alter table public.cliente_acuerdos
  alter column familia set not null;

-- El índice viejo era (email, version): una fila por persona por versión, sin
-- importar de qué trataba. Ahora una persona puede tener varias familias
-- pendientes a la vez, así que la familia entra a la llave.
drop index if exists uq_cliente_acuerdo_version;
create unique index if not exists uq_cliente_acuerdo_familia_version
  on public.cliente_acuerdos (email, familia, version);

create index if not exists idx_cliente_acuerdos_email_familia
  on public.cliente_acuerdos (email, familia);

comment on column public.cliente_acuerdos.familia is
  'licencia | exclusiva | personalizado | servicio | ep_album — ver lib/acuerdos/familias.ts';
