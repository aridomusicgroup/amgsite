-- Para proyectos tipo EP/Álbum, cada canción es una fila en proyecto_tareas
-- (no el proyecto en sí) — necesita su propio marcador de "ya se le creó su
-- carpeta+proyecto de REAPER", independiente del proyectos.reaper_creado.
alter table proyecto_tareas add column if not exists reaper_creado boolean not null default false;
