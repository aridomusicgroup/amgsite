-- Evita que reaper-sync avise "sin cliente ligado" del mismo proyecto una y
-- otra vez cada 2 minutos para siempre. Una vez avisado, se calla — cuando el
-- proyecto por fin tenga contacto_id, se procesa normal en la siguiente corrida
-- (esta columna solo silencia el aviso repetido, no bloquea la creación).
alter table proyectos add column if not exists reaper_aviso boolean not null default false;
