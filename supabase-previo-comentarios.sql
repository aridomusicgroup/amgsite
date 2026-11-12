-- ============================================================================
-- Comentarios del cliente sobre sus previos (2026-11-11)
-- ============================================================================
-- Bajo cada previo de /cuenta/pedido/<id> el cliente puede escribir qué quiere
-- cambiar (y, si quiere, marcar el minuto). Cada comentario:
--   · nace como UNA TAREA del proyecto (título corto de lo que pide; el detalle
--     completo va en las notas de la tarea), y
--   · queda aquí como histórico: qué pidió, sobre cuál previo, en qué minuto y
--     cuándo. Si se atendió o no sale de la tarea (hecho), no se duplica aquí.
--
-- Sin esta tabla el sitio funciona igual: la caja de comentarios no aparece en
-- el panel del cliente. Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

create table if not exists public.previo_comentarios (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references public.proyectos(id)       on delete cascade,
  -- El previo (render) sobre el que se comentó. Se conserva el número aparte
  -- porque el render puede borrarse y el comentario debe seguir diciendo "Previo 2".
  job_id       uuid          references public.render_jobs(id)     on delete set null,
  previo_num   int,
  -- En EP/álbum, la canción. Null en lo demás.
  tema_id      uuid          references public.proyecto_tareas(id) on delete set null,
  -- La tarea que nació de este comentario. Si la borran, el histórico se queda.
  tarea_id     uuid          references public.proyecto_tareas(id) on delete set null,
  texto        text not null,
  -- Segundo del previo que marcó el cliente (null = no marcó ninguno).
  segundo      int,
  autor_email  text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_previo_comentarios_proyecto on public.previo_comentarios (proyecto_id, created_at desc);
create index if not exists idx_previo_comentarios_tarea    on public.previo_comentarios (tarea_id);
create index if not exists idx_previo_comentarios_job      on public.previo_comentarios (job_id);

-- RLS prendido: el cliente no es usuario de Supabase Auth, así que sólo entra
-- el service-role desde las rutas del servidor (más la lectura del equipo, abajo).
alter table public.previo_comentarios enable row level security;

-- En vivo: que el proyecto abierto en el panel se actualice solo cuando el
-- cliente comenta (mismo patrón que la bitácora). Con RLS prendido, Realtime
-- sólo entrega eventos a quien pueda LEER la tabla: por eso la política para el
-- equipo. El cliente sigue sin acceso directo (entra por las rutas del servidor).
drop policy if exists staff_rt_read on public.previo_comentarios;
create policy staff_rt_read on public.previo_comentarios for select to authenticated using (public.is_staff());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'previo_comentarios') then
    alter publication supabase_realtime add table public.previo_comentarios;
  end if;
end $$;
