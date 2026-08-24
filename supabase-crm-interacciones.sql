-- ============================================================================
-- CRM · Fase 1 — historial de interacciones
-- ============================================================================
-- La tabla `interacciones` ya existía (supabase-erp-schema.sql) pero estaba
-- VACÍA: las conversaciones del bot viven en MongoDB (Railway) y nunca llegaban
-- al CRM de Supabase. Este SQL agrega lo único que faltaba para poder
-- espejearlas sin duplicar.
--
-- `external_id` = llave de idempotencia. El backend la arma como
--   "<canal>:<userId>:<YYYY-MM-DD>"  (un renglón por conversación por día)
-- así el mismo día se ACTUALIZA en vez de insertar de nuevo, sin importar
-- cuántos mensajes lleguen ni cuántas veces corra el sync.
--
-- Correr en el SQL Editor de Supabase. Es idempotente: se puede correr 2 veces.
-- ============================================================================

alter table public.interacciones
  add column if not exists external_id text;

-- Índice ÚNICO (NO parcial). Ojo: un índice PARCIAL (`where external_id is not
-- null`) NO sirve aquí — Postgres no lo empata con `ON CONFLICT (external_id)`
-- salvo que se repita el predicado, y supabase-js no lo genera: el upsert
-- revienta con "no unique or exclusion constraint matching the ON CONFLICT".
-- No hace falta que sea parcial: en Postgres los NULL son distintos entre sí,
-- así que las notas manuales (sin external_id) conviven sin chocar.
drop index if exists uq_interacciones_external_id;
create unique index if not exists uq_interacciones_external_id
  on public.interacciones (external_id);

-- La línea de tiempo se lee por contacto y en orden cronológico inverso.
create index if not exists idx_interacciones_contacto_fecha
  on public.interacciones (contacto_id, ocurrio_at desc);
