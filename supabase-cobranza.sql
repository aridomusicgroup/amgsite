-- ============================================================================
-- Cobranza · la escalera de tres toques y la marca de no contactar
-- ============================================================================
-- Correr en el SQL Editor de Supabase. Idempotente: se puede correr 2 veces.
-- ============================================================================

-- ── 1. `interacciones.tipo` acepta el toque de cobranza ─────────────────────
-- Cada toque enviado se sella como una interacción con
-- `external_id = 'cobranza:<venta>:<toque>'`, y el índice único que ya existe
-- (supabase-crm-interacciones.sql) es lo que evita mandar dos veces el mismo
-- toque. Sin ampliar este CHECK el insert revienta con "violates check
-- constraint" y el botón no guarda nada — exactamente lo que pasó con recompra.
alter table public.interacciones
  drop constraint if exists interacciones_tipo_check;

alter table public.interacciones
  add constraint interacciones_tipo_check
  check (tipo in (
    'mensaje_in','mensaje_out','venta','lead_form','click_utm','seguimiento','nota',
    'recompra','recompra_omitida',
    -- Cobranza: se le mandó un toque de saldo (1 recordatorio, 2 acomodo, 3 cierre).
    'cobranza'
  ));

-- ── 2. No contactar ─────────────────────────────────────────────────────────
-- Hoy NO existe ninguna forma de registrar "a esta persona ya no le
-- escribimos". Sin esto, cualquier automatización le seguiría mandando correos
-- a quien ya nos bloqueó en WhatsApp e Instagram — que es cómo se acumulan
-- quejas de spam y se quema el dominio de envío.
--
-- Es lo único que hace segura la escalera de cobranza, y se prende sola al
-- mandar el toque 3 (el de cierre, que promete ser el último correo).
alter table public.contactos add column if not exists no_contactar boolean not null default false;
alter table public.contactos add column if not exists no_contactar_motivo text;
alter table public.contactos add column if not exists no_contactar_at timestamptz;

-- Parcial: sólo interesa buscar a los marcados, que van a ser pocos.
create index if not exists idx_contactos_no_contactar
  on public.contactos (no_contactar)
  where no_contactar = true;

comment on column public.contactos.no_contactar is
  'No escribirle por ningún canal automático (cobranza, recompra, seguimientos). Se prende a mano o al mandar el toque 3 de cobranza.';
