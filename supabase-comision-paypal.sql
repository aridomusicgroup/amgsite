-- ============================================================================
-- Comisión de PayPal en la cotización (2026-08-04)
-- ============================================================================
-- Cuando el cliente paga con PayPal, la plataforma se queda un 6%. Si ese 6% no
-- se cotiza, sale del bolsillo de la casa productora: cotizas 6,000, te
-- depositan ~5,640 y nadie ve a dónde se fue la diferencia.
--
-- Se guarda el PORCENTAJE (no un simple sí/no) para que cada documento conserve
-- la comisión con la que se cotizó. Si mañana PayPal cobra 5.4%, las
-- cotizaciones viejas siguen cuadrando con lo que el cliente ya firmó.
--
-- Correr en el SQL Editor de Supabase. Idempotente: se puede correr 2 veces.
-- ============================================================================

alter table cotizaciones add column if not exists comision_pct numeric(5,2) not null default 0;

-- Lo que ya existe se cotizó sin comisión: queda en 0 y su total no se mueve.
