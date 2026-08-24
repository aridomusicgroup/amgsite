-- Pagos a músicos de sesión, ligados a la venta (COGS itemizado).
-- El reparto sigue leyendo ventas.costo_extra, que la API mantiene = SUMA de estos
-- pagos (así no hay doble conteo y hay trazabilidad de a quién/cuándo/estado).
create table if not exists public.pagos_musico (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas(id) on delete cascade,
  musico text,                                  -- nombre del músico
  monto numeric not null default 0,
  fecha date,
  medio_pago text,
  pagado boolean not null default true,          -- false = pendiente por pagar
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_pagos_musico_venta on public.pagos_musico(venta_id);

-- RLS: igual que el resto del panel (lecturas solo server-side con service-role;
-- realtime solo para staff).
alter table public.pagos_musico enable row level security;
drop policy if exists staff_rt_read on public.pagos_musico;
create policy staff_rt_read on public.pagos_musico
  for select to authenticated using (public.is_staff());

-- Realtime (idempotente).
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pagos_musico'
  ) then
    alter publication supabase_realtime add table public.pagos_musico;
  end if;
end $$;
