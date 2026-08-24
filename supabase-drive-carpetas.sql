-- Carpetas de Drive para clientes/proyectos, creadas solas la primera vez que
-- un cliente sube un archivo desde su pedido. Mismo patrón que beat_carpetas:
-- se guarda el ID una vez resuelto para no tener que buscar/crear cada vez.
alter table contactos add column if not exists drive_folder_id text;
alter table proyectos add column if not exists drive_folder_id text;
