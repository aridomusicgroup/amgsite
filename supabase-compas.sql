-- ============================================================================
-- COMPÁS por proyecto y por tema · 2026-09-15 · se puede correr más de una vez.
--
-- Junto con el BPM, el script del estudio lo pone en el .rpp (línea
-- `TEMPO 154 6 8`) mientras el proyecto no se haya guardado en REAPER.
-- Formato "num/den": 4/4, 3/4, 6/8, 12/8…
-- ============================================================================

alter table public.proyectos       add column if not exists compas text;
alter table public.proyecto_tareas add column if not exists compas text;

do $$ begin
  alter table public.proyectos add constraint proyectos_compas_formato
    check (compas is null or compas ~ '^[0-9]{1,2}/(1|2|4|8|16|32)$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.proyecto_tareas add constraint proyecto_tareas_compas_formato
    check (compas is null or compas ~ '^[0-9]{1,2}/(1|2|4|8|16|32)$');
exception when duplicate_object then null; end $$;

-- REVISIÓN: las dos columnas deben existir.
select table_name, column_name from information_schema.columns
where table_schema = 'public' and column_name = 'compas'
  and table_name in ('proyectos', 'proyecto_tareas');
