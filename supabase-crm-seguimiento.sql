-- ============================================================================
-- CRM · Fase 2 — próxima acción y recordatorios
-- ============================================================================
-- Hoy hay ~90 leads y negociaciones abiertos (el más viejo de 37 días) sin
-- forma de saber QUÉ sigue con cada uno ni CUÁNDO. Estas dos columnas son el
-- corazón de un CRM: convierten una lista de contactos en una lista de tareas.
--
--   proxima_accion → qué toca hacer  ("llamar", "mandar cotización")
--   proxima_fecha  → cuándo toca
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.contactos
  add column if not exists proxima_accion text,
  add column if not exists proxima_fecha  date;

-- El cron diario pregunta "¿qué vence hoy o ya venció?" — índice parcial porque
-- la gran mayoría de contactos no tiene seguimiento programado.
create index if not exists idx_contactos_proxima_fecha
  on public.contactos (proxima_fecha)
  where proxima_fecha is not null;
