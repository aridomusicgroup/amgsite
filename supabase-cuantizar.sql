-- Cuadrar a la rejilla: un tipo más de trabajo en la cola que ya existe.
--
-- No lleva tabla nueva ni columnas nuevas a propósito. Un trabajo de cuadrar es
-- lo mismo que un render desde el punto de vista de la cola —se encola, se toma
-- de a uno, tarda un rato y deja archivos— así que se cuelga de `render_jobs` y
-- hereda gratis la barredora de atascados, el candado de uno a la vez, los
-- reintentos al marcar estado y la consola de logs del panel.
--
-- Lo que NO hereda, y está cortado a mano en jobs.js: la subida a Drive y el
-- aviso al cliente. Lo que produce es un proyecto de REAPER, no un entregable;
-- mandárselo al cliente sería mandarle el andamio en vez de la canción.
--
-- Correr esto ANTES de usar el botón del panel. Sin el tipo dado de alta, el
-- insert lo rebota el CHECK y el botón devuelve un error (no rompe nada más).

alter table public.render_jobs drop constraint if exists render_jobs_tipo_check;
alter table public.render_jobs add constraint render_jobs_tipo_check
  check (tipo in ('previo', 'entregables', 'stems', 'musico', 'cuantizar'));
