-- ============================================================================
-- Tipo de servicio + esquema de pago por cotización (2026-08-07)
-- ============================================================================
-- HALLAZGO al construir esto: `cotizaciones` NUNCA tuvo columna `tipo`. Solo
-- los CONTRATOS (que nacen después, al convertir) tienen tipo. Eso significa
-- que el enlace de firma antes del anticipo (`app/api/admin/cotizaciones/
-- enviar/route.ts`, que lee `c.tipo` para decidir si manda el acuerdo) NUNCA
-- se ha disparado en producción — silenciosamente, sin error, porque
-- `familiaDeCotizacion(undefined)` simplemente devuelve null. Esta migración
-- es la que de verdad activa esa fase.
--
-- Con `tipo` en la cotización de una vez se resuelve también el esquema de
-- pago: antes solo existía "anticipo 50% + resto al entregar" a mano, sin
-- opciones. Un EP de tres meses no se cobra igual que un beat suelto — se
-- agregan 5 esquemas seleccionables (estándar / por etapas / por canción /
-- mensualidades / de contado). Los tramos reales se calculan en
-- `lib/esquema-pago.ts` (módulo puro) a partir del total y, para "por
-- canción", del número de canciones — no se guardan los montos, solo la
-- ELECCIÓN, así si se corrige el total de la cotización los tramos se
-- recalculan solos.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.cotizaciones
  add column if not exists tipo text,
  add column if not exists esquema_pago text,
  add column if not exists num_canciones integer;

comment on column public.cotizaciones.tipo is
  'ContractTipo: beat_personalizado | exclusiva | produccion | servicio | ep_album | generico. Decide el acuerdo a firmar antes del anticipo.';

comment on column public.cotizaciones.esquema_pago is
  'estandar | etapas | por_cancion | mensualidades | contado — ver lib/esquema-pago.ts';
comment on column public.cotizaciones.num_canciones is
  'Solo cuando esquema_pago = por_cancion: cuántas canciones tiene el proyecto.';
