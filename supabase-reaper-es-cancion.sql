-- Distingue, dentro de un proyecto EP/Álbum, qué tareas son canciones de
-- verdad (cada una necesita su propio proyecto de REAPER) de tareas
-- administrativas que a veces se agregan a mano (ej. "Subir a Drive",
-- "Pasar carpetas a Diego") — esas NUNCA deben generar carpeta de REAPER.
-- Se marca sola en true cuando la tarea nace del flujo "Canciones (EP/Álbum)"
-- al crear el proyecto; cualquier tarea agregada después queda en false salvo
-- que alguien la marque a mano.
alter table proyecto_tareas add column if not exists es_cancion boolean not null default false;
