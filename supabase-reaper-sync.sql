-- Marca qué proyectos de producción ya tienen su carpeta + proyecto de REAPER
-- creados (ver reaper-sync/). Sin esta columna el script no tendría forma de
-- saber qué ya procesó y volvería a copiar la plantilla cada vez que corre.
alter table proyectos add column if not exists reaper_creado boolean not null default false;
