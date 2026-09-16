-- ============================================================================
-- Anticipos a músicos (2026-09-16)
-- ============================================================================
-- A veces se le da a un músico sólo una parte (p. ej. a Rodrigo la mitad).
-- El pago sigue siendo UNO (el costo de la venta no cambia); lo que se le ha
-- dado va en `abonos` = [{ monto, fecha, medio_pago }]. Mientras la suma no
-- llegue al monto, el pago sigue PENDIENTE por lo que resta.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.pagos_musico
  add column if not exists abonos jsonb not null default '[]'::jsonb;

-- Revisión: debe salir la columna.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'pagos_musico' and column_name = 'abonos';
