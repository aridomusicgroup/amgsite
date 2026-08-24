-- ============================================================================
-- CRM · Fase 4 — recompra (retención)
-- ============================================================================
-- La bandeja de recompra sella su decisión como una interacción, usando
-- `external_id = 'recompra:<contacto>:<fecha última compra>'` (índice único ya
-- creado en supabase-crm-interacciones.sql) para que el mismo cliente no
-- reaparezca mañana, y para que una compra nueva re-arme el ciclo solo.
--
-- Lo único que falta: `interacciones.tipo` tiene un CHECK con la lista cerrada
-- original, que NO incluye los dos tipos nuevos. Sin esto, el insert revienta
-- con "violates check constraint" y el botón no guarda nada.
--
-- Correr en el SQL Editor de Supabase. Idempotente: se puede correr 2 veces.
-- ============================================================================

alter table public.interacciones
  drop constraint if exists interacciones_tipo_check;

alter table public.interacciones
  add constraint interacciones_tipo_check
  check (tipo in (
    'mensaje_in','mensaje_out','venta','lead_form','click_utm','seguimiento','nota',
    -- Fase 4: se le escribió para ofrecerle lo siguiente / se descartó el ciclo.
    'recompra','recompra_omitida'
  ));

-- La bandeja pregunta "¿qué ciclos ya se resolvieron?" con un like sobre
-- external_id; el índice único existente ya lo resuelve, pero este lo deja
-- explícito para el prefijo.
create index if not exists idx_interacciones_external_prefix
  on public.interacciones (external_id text_pattern_ops);
