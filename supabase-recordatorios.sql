-- ============================================================================
-- Recordatorios por tarea y POR USUARIO (2026-07-31)
-- ============================================================================
-- Cada quien se pone su propio recordatorio en la tarea que quiera, con fecha y
-- hora. Llegado el momento le avisa por push en el panel Y por correo, con la
-- info de la tarea adentro (proyecto, notas, subtareas pendientes).
--
-- Por qué la tabla es aparte y no una columna en `proyecto_tareas`:
-- el recordatorio es de la PERSONA, no de la tarea. Dos personas pueden mirar
-- la misma tarea y querer que les avise a horas distintas; una columna solo
-- dejaría uno vivo y le pisaría el suyo al otro.
--
-- Correr en el SQL Editor de Supabase. Idempotente: se puede correr 2 veces.
-- ============================================================================

create table if not exists public.tarea_recordatorios (
  id            uuid primary key default gen_random_uuid(),
  tarea_id      uuid not null references public.proyecto_tareas(id) on delete cascade,
  -- Dueño del recordatorio: el correo de su sesión del panel. Nunca viene del
  -- navegador, siempre se toma de la sesión en el servidor.
  email         text not null,
  recordar_at   timestamptz not null,
  nota          text,
  -- null = pendiente. Se sella al mandarlo, y es lo que evita que el mismo
  -- recordatorio se mande otra vez en la siguiente pasada del cron.
  enviado_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Uno por persona por tarea: volver a ponerlo ACTUALIZA el suyo, no acumula.
create unique index if not exists uq_tarea_recordatorio_usuario
  on public.tarea_recordatorios (tarea_id, email);

-- El cron pregunta siempre lo mismo: "¿qué está pendiente y ya venció?".
-- El índice parcial deja fuera todo lo ya enviado, que es la mayoría con el tiempo.
create index if not exists idx_tarea_recordatorios_pendientes
  on public.tarea_recordatorios (recordar_at)
  where enviado_at is null;

-- La bandeja de cada quien: "mis recordatorios" en el tablero.
create index if not exists idx_tarea_recordatorios_email
  on public.tarea_recordatorios (email);

alter table public.tarea_recordatorios enable row level security;

-- Realtime: el panel ya escucha cambios y refresca solo (useRealtimeRefresh).
do $$
begin
  alter publication supabase_realtime add table public.tarea_recordatorios;
exception
  when duplicate_object then null;  -- ya estaba en la publicación
  when undefined_object then null;  -- no existe la publicación (entorno sin realtime)
end $$;
