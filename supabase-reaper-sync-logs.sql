-- Consola de logs de reaper-sync (el script local que crea carpetas/proyectos
-- de REAPER). No es información operativa del equipo — es una herramienta de
-- desarrollo, visible SOLO para altiplanoprod@gmail.com.

create table if not exists public.reaper_sync_logs (
  id         uuid primary key default gen_random_uuid(),
  nivel      text not null default 'info' check (nivel in ('info', 'warn', 'error')),
  mensaje    text not null,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_reaper_sync_logs_created on public.reaper_sync_logs(created_at desc);

alter table public.reaper_sync_logs enable row level security;  -- sin policy: no legible por nadie salvo lo de abajo

-- Lectura en tiempo real SOLO para el desarrollador (el panel admin lee con
-- service-role de cualquier forma; esto solo habilita que Realtime le entregue
-- los cambios en el navegador).
drop policy if exists dev_rt_read on public.reaper_sync_logs;
create policy dev_rt_read on public.reaper_sync_logs for select to authenticated
  using ((auth.jwt() ->> 'email') = 'djrochaoerre@gmail.com');

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reaper_sync_logs') then
    alter publication supabase_realtime add table public.reaper_sync_logs;
  end if;
end $$;
