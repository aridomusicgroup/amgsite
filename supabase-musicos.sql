-- Catálogo de músicos de sesión (proveedores): quién toca qué instrumento.
-- Alimenta la sugerencia automática en "Pagos a músicos" según los instrumentos
-- de cada venta (ventas.extras).
create table if not exists public.musicos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  instrumentos text[] not null default '{}',     -- ej. {tololoche, bajo}
  tarifa numeric default 0,                        -- monto sugerido por sesión (opcional)
  telefono text,
  activo boolean not null default true,
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_musicos_activo on public.musicos(activo);

alter table public.musicos enable row level security;
drop policy if exists staff_rt_read on public.musicos;
create policy staff_rt_read on public.musicos
  for select to authenticated using (public.is_staff());

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'musicos'
  ) then
    alter publication supabase_realtime add table public.musicos;
  end if;
end $$;
