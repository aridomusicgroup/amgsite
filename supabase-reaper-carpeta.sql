-- ============================================================================
-- Carpeta de REAPER anclada (2026-09-11)
-- ============================================================================
-- El script del estudio encuentra la carpeta de cada proyecto SÓLO por su
-- nombre: RAÍZ / CLIENTE / TÍTULO (y / TEMA en un EP). Renombrar el proyecto en
-- el panel hacía que dejara de encontrarla: el inventario la daba por perdida,
-- los renders fallaban y las pistas de los músicos caían en una carpeta nueva
-- y vacía con el nombre nuevo.
--
--   reaper_carpeta    el nombre REAL de la carpeta en disco, cuando ya no
--                     coincide con el título. Null = se llama como el título.
--   reaper_renombrar  encargo del panel: "renombra la carpeta a esto". El script
--                     lo hace en su siguiente vuelta y lo limpia.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.proyectos       add column if not exists reaper_carpeta   text;
alter table public.proyectos       add column if not exists reaper_renombrar text;
alter table public.proyecto_tareas add column if not exists reaper_carpeta   text;
alter table public.proyecto_tareas add column if not exists reaper_renombrar text;

comment on column public.proyectos.reaper_carpeta is
  'Nombre real de la carpeta de REAPER cuando ya no coincide con el título (se ancla al renombrar). Null = se deriva del título.';
comment on column public.proyectos.reaper_renombrar is
  'Encargo para el script del estudio: renombrar la carpeta en disco a este nombre. Lo limpia al terminar.';
