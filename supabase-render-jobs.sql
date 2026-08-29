-- Cola de renders de REAPER: el panel encola, el script local (reaper-sync)
-- ejecuta. El panel NO puede tocar tu disco ni abrir REAPER — por eso es una
-- cola y no una llamada directa. Si REAPER está cerrado el trabajo espera, no
-- se pierde.
--
-- Herramienta de desarrollo: se lee desde /admin/dev-logs, visible solo para
-- djrochaoerre@gmail.com (misma política que reaper_sync_logs).

create table if not exists public.render_jobs (
  id           uuid primary key default gen_random_uuid(),
  -- Qué renderizar. Producción normal → solo proyecto_id.
  -- Canción de EP/Álbum → además tarea_id (cada canción es su propio .rpp).
  proyecto_id  uuid not null references public.proyectos(id) on delete cascade,
  tarea_id     uuid references public.proyecto_tareas(id) on delete cascade,
  tipo         text not null check (tipo in ('previo', 'entregables', 'stems')),
  estado       text not null default 'pendiente'
               check (estado in ('pendiente', 'renderizando', 'subiendo', 'listo', 'error')),
  -- Solo para 'previo': 1, 2, 3… Se calcula al encolar (max anterior + 1) para
  -- que el nombre del archivo sea "… PREVIO 2" sin que dos renders choquen.
  previo_num   int,
  -- Rutas locales que produjo REAPER y, si se subieron, sus links de Drive.
  archivos     jsonb,
  drive_urls   jsonb,
  error        text,
  pedido_por   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_render_jobs_pendientes on public.render_jobs(estado, created_at)
  where estado in ('pendiente', 'renderizando', 'subiendo');
create index if not exists idx_render_jobs_proyecto on public.render_jobs(proyecto_id, tipo);

alter table public.render_jobs enable row level security;

drop policy if exists dev_rt_read on public.render_jobs;
create policy dev_rt_read on public.render_jobs for select to authenticated
  using ((auth.jwt() ->> 'email') = 'djrochaoerre@gmail.com');

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='render_jobs') then
    alter publication supabase_realtime add table public.render_jobs;
  end if;
end $$;
