-- ============================================================================
-- BOLSAS, REPARTO DE AGOSTO Y MEDIOS DE PAGO · 2026-09-12
-- Se puede correr más de una vez: cada parte revisa si ya se hizo.
--   1. finanzas_ajustes: % de impuestos y colchón, meta, saldo inicial del
--      fondo y escalones del sueldo de socios (una sola fila, id = 1).
--   2. Los $73,637 del 24-ago pasan de nómina ("sueldo") a reparto.
--   3. El medio de pago queda con un solo nombre por medio.
-- ============================================================================

-- 1. AJUSTES DE LAS BOLSAS ---------------------------------------------------
create table if not exists public.finanzas_ajustes (
  id              int primary key default 1 check (id = 1),
  impuestos_pct   numeric(5,2)  not null default 10,
  colchon_pct     numeric(5,2)  not null default 15,
  colchon_meta    numeric(12,2) not null default 80000,
  colchon_inicial numeric(12,2) not null default 0,
  inicio          date          not null default '2026-09-01',
  escalones       jsonb         not null default '[{"desde":60000,"semanal":2000},{"desde":50000,"semanal":1500},{"desde":0,"semanal":1200}]',
  updated_at      timestamptz default now(),
  updated_by      text
);
alter table public.finanzas_ajustes enable row level security;
insert into public.finanzas_ajustes (id) values (1) on conflict (id) do nothing;

-- 2. REPARTO DEL 24-AGO (antes registrado como sueldo) ------------------------
do $$
declare
  ids uuid[] := array['fd9714ca-e1a9-45e9-b09c-05465ed84f8d', '5ff86c0a-a9c1-4029-bb92-e56d4fbe9dc2']::uuid[];
  rid uuid;
begin
  if (select count(*) from public.nomina where id = any(ids) and monto = 36818.50 and periodo_inicio = '2026-08-24') = 2
     and not exists (select 1 from public.repartos where periodo = '2026-T3' and notas like 'Reparto a cuenta del 24-ago%') then
    insert into public.repartos (periodo, fecha_inicio, fecha_fin, utilidad_repartible, reserva_pct, estado, notas)
    values ('2026-T3', '2026-07-01', '2026-09-30', 73637, 0, 'pagado',
            'Reparto a cuenta del 24-ago; antes registrado como sueldo en nómina.')
    returning id into rid;

    insert into public.reparto_socio (reparto_id, socio_id, participacion_pct, monto, estado, fecha_pago)
    select rid, persona_id, 50, monto, 'pagado', '2026-08-24'
    from public.nomina where id = any(ids);

    delete from public.nomina where id = any(ids);
  end if;
end $$;

-- 3. MEDIO DE PAGO CON UN SOLO NOMBRE ----------------------------------------
create or replace function public.normalizar_medio_pago(t text) returns text
language sql immutable as $$
  select case
    when t is null or btrim(t) = '' then null
    when lower(btrim(t)) = 'zelle' then 'Zelle'
    when lower(btrim(t)) like 'transferencia%' then 'Transferencia'
    when lower(btrim(t)) = 'paypal' then 'PayPal'
    when lower(btrim(t)) = 'stripe' then 'Stripe'
    when lower(btrim(t)) = 'beatstars' then 'BeatStars'
    when lower(btrim(t)) = 'efectivo' then 'Efectivo'
    else btrim(t)
  end
$$;

update public.ventas set medio_pago = public.normalizar_medio_pago(medio_pago)
where medio_pago is distinct from public.normalizar_medio_pago(medio_pago);

update public.pagos set medio_pago = public.normalizar_medio_pago(medio_pago)
where medio_pago is distinct from public.normalizar_medio_pago(medio_pago);

-- REVISIÓN: debe salir 1 reparto 2026-T3 con 2 socios, y los medios limpios.
select r.periodo, r.estado, r.utilidad_repartible, count(s.id) as socios, sum(s.monto) as repartido
from public.repartos r left join public.reparto_socio s on s.reparto_id = r.id
group by r.id order by r.periodo;

select 'ventas' as tabla, medio_pago, count(*) from public.ventas group by medio_pago
union all
select 'pagos', medio_pago, count(*) from public.pagos group by medio_pago
order by 1, 3 desc;
