-- Inventario de lo que hay dentro de cada carpeta de proyecto de REAPER.
--
-- Por qué existe: el panel corre en Vercel y los .rpp viven en el disco local
-- (X:\REAPER Media\LATINOGANG). El navegador NO puede leer esa carpeta, así que
-- para poder ofrecer "elige el .rpp base / el rango / las pistas" antes de
-- encolar, el script local publica aquí lo que encuentra y el panel lo lee.
--
-- Se refresca en cada corrida del cron (cada 2 min) y sólo se re-parsea el .rpp
-- cuyo mtime cambió, así que el costo es despreciable.

create table if not exists public.render_inventario (
  -- tarea_id cuando es canción de EP/Álbum, si no proyecto_id. Se usa como PK
  -- porque un índice único sobre (proyecto_id, tarea_id) no sirve: en Postgres
  -- dos filas con tarea_id NULL no se consideran duplicadas.
  clave        text primary key,
  proyecto_id  uuid not null references public.proyectos(id) on delete cascade,
  tarea_id     uuid references public.proyecto_tareas(id) on delete cascade,
  carpeta      text,
  -- [{ archivo, mtime, bytes, marcadores:[{nombre,seg}], seleccion:{inicio,fin,valida}, pistas:[{nombre,esStem,silenciada}] }]
  proyectos    jsonb not null default '[]'::jsonb,
  -- Por qué no se pudo leer (carpeta inexistente, sin .rpp). Se muestra en el panel.
  error        text,
  escaneado_en timestamptz not null default now()
);

create index if not exists idx_render_inventario_proyecto on public.render_inventario(proyecto_id);

alter table public.render_inventario enable row level security;

drop policy if exists dev_inv_read on public.render_inventario;
create policy dev_inv_read on public.render_inventario for select to authenticated
  using ((auth.jwt() ->> 'email') = 'djrochaoerre@gmail.com');

-- Elecciones que hizo el usuario en el cuadro de opciones antes de encolar.
-- Nulo = comportamiento automático de siempre (último .rpp, proyecto completo,
-- pistas que decida el script). Los trabajos viejos siguen funcionando igual.
alter table public.render_jobs add column if not exists opciones jsonb;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='render_inventario') then
    alter publication supabase_realtime add table public.render_inventario;
  end if;
end $$;
