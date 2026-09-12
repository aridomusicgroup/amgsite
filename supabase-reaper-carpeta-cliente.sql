-- ============================================================================
-- Carpeta de REAPER del CLIENTE, anclada (2026-09-11)
-- ============================================================================
-- Igual que la del proyecto (supabase-reaper-carpeta.sql), un nivel arriba: la
-- ruta es RAÍZ / CLIENTE / PROYECTO, y el nombre del cliente también cambia.
-- Pasó con Alfred: sus carpetas nacieron en "ALFRED", el contacto se renombró a
-- "Alfred Kerr", y P0057 y P0062 dejaron de encontrarse (no podían renderizar
-- ni recibir pistas de músicos). Se arregló renombrando la carpeta a mano; esto
-- es para que la próxima vez se ancle sola y pregunte.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

alter table public.contactos add column if not exists reaper_carpeta   text;
alter table public.contactos add column if not exists reaper_renombrar text;

comment on column public.contactos.reaper_carpeta is
  'Nombre real de la carpeta del cliente en REAPER cuando ya no coincide con su nombre (se ancla al renombrarlo). Null = se deriva del nombre.';
