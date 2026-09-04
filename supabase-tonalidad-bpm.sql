-- Tonalidad y BPM de la producción.
--
-- Se capturan al crear la venta/proyecto y el previo de músico los toma de aquí
-- en vez de pedirlos cada vez. Si no se pusieron al crear, se guardan solos la
-- primera vez que se escriben en el panel de REAPER.
--
-- Van en las DOS tablas porque en un EP cada canción tiene su propia tonalidad:
-- guardarla en el álbum sería mandarle al músico el tono equivocado en todas
-- menos una.
alter table public.proyectos add column if not exists tonalidad text;
alter table public.proyectos add column if not exists bpm int;

alter table public.proyecto_tareas add column if not exists tonalidad text;
alter table public.proyecto_tareas add column if not exists bpm int;
