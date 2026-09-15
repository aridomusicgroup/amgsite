-- ============================================================================
-- PAGOS RECURRENTES QUE NO SON MENSUALES · 2026-09-15
-- La luz de CFE se paga cada 2 meses; con solo `dia_mes` el panel la daba por
-- vencida cada mes. `cada_meses`: 1 = mensual (lo de siempre), 2 = bimestral,
-- 3 = trimestral, 6 = semestral, 12 = anual. Se puede correr más de una vez.
-- ============================================================================

alter table public.gastos_recurrentes
  add column if not exists cada_meses integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gastos_recurrentes_cada_meses_chk') then
    alter table public.gastos_recurrentes
      add constraint gastos_recurrentes_cada_meses_chk check (cada_meses between 1 and 12);
  end if;
end $$;

-- La luz (CFE) se paga cada 2 meses.
update public.gastos_recurrentes
set cada_meses = 2, updated_at = now()
where id = '265963b5-58d6-4f73-827d-e0c9465e41db';

-- REVISIÓN: la luz debe salir con cada_meses = 2 y lo demás con 1.
select nombre, proveedor, dia_mes, cada_meses, monto_estimado
from public.gastos_recurrentes
order by dia_mes;
