-- ============================================================================
-- EP/ÁLBUM POR TEMA · DURACIÓN DEL .RPP · RETIRAR ARCHIVOS DE MÚSICOS
-- 2026-09-15 · se puede correr más de una vez.
--
--   cotizaciones.temas        [{nombre, conceptos: [labels]}] — qué lleva cada tema
--   proyecto_tareas.conceptos lo cotizado para ESE tema (instrumentos, paquete)
--   *.duracion_seg            largo del .rpp medido por el script del estudio,
--                             para avisarle al músico si su archivo no cuadra
--   musico_archivos.retirar_at el archivo se pidió borrar; el script quita la
--                             copia de la PC (y la toma del .rpp) y luego la fila
-- ============================================================================

alter table public.cotizaciones    add column if not exists temas jsonb;
alter table public.proyecto_tareas add column if not exists conceptos jsonb;

alter table public.proyectos       add column if not exists duracion_seg numeric(8,2);
alter table public.proyectos       add column if not exists duracion_rpp_at timestamptz;
alter table public.proyecto_tareas add column if not exists duracion_seg numeric(8,2);
alter table public.proyecto_tareas add column if not exists duracion_rpp_at timestamptz;

alter table public.musico_archivos add column if not exists retirar_at timestamptz;
alter table public.musico_archivos add column if not exists retirado_por text;
create index if not exists idx_musico_archivos_retirar
  on public.musico_archivos(retirar_at) where retirar_at is not null;

-- COT-0063 (Juanjo Pemberthy) se guardó sin formato: es un EP.
update public.cotizaciones set ep_album_formato = 'ep'
where id = 'c58f0538-35c5-471b-862f-118df78e309a' and ep_album_formato is null;

-- REVISIÓN: las 8 columnas deben existir.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('cotizaciones', 'temas'), ('proyecto_tareas', 'conceptos'),
    ('proyectos', 'duracion_seg'), ('proyectos', 'duracion_rpp_at'),
    ('proyecto_tareas', 'duracion_seg'), ('proyecto_tareas', 'duracion_rpp_at'),
    ('musico_archivos', 'retirar_at'), ('musico_archivos', 'retirado_por'))
order by 1, 2;
