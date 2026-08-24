-- ============================================================================
-- Cotizar y contratar en DÓLARES (2026-08-04)
-- ============================================================================
-- `cotizaciones` y `contratos` ya tenían `moneda`, pero el total se guardaba
-- crudo: una cotización de 500 USD quedaba como "500" sin más. Al convertirla
-- en venta se copiaba ese 500 a `total_mxn` y el Dashboard contaba 500 pesos en
-- vez de ~8,450. De ahí el aviso que decía "ajusta el total a MXN en Ventas".
--
-- Ahora cada documento guarda TAMBIÉN el tipo de cambio que se usó y su
-- equivalente en pesos, igual que `ventas`. El tipo de cambio se guarda para
-- que el número en pesos sea auditable: sin él, nadie sabría de dónde salió.
--
-- Correr en el SQL Editor de Supabase. Idempotente: se puede correr 2 veces.
-- ============================================================================

alter table cotizaciones add column if not exists tipo_cambio numeric(10,4);
alter table cotizaciones add column if not exists total_mxn   numeric(12,2);

alter table contratos    add column if not exists tipo_cambio numeric(10,4);
alter table contratos    add column if not exists monto_mxn   numeric(12,2);

-- Lo que ya existe está en pesos (se comprobó: 15 de 15 cotizaciones en MXN, y
-- de 3 contratos solo 1 en USD). Se rellena el espejo en pesos para que los
-- reportes no vean huecos; el contrato en dólares se deja en null a propósito,
-- para que quien lo edite le ponga el tipo de cambio que de verdad se pactó.
update cotizaciones set total_mxn = total where total_mxn is null and coalesce(moneda,'MXN') = 'MXN';
update contratos    set monto_mxn = monto where monto_mxn is null and coalesce(moneda,'MXN') = 'MXN';
