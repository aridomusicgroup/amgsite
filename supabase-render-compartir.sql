-- Avisar al cliente cuando un render queda listo.
--
-- `compartir` es una columna y no un campo dentro de `opciones` porque manda
-- DOS cosas que se consultan seguido: si se manda el correo, y si el archivo
-- aparece en el panel del cliente. Un render sin marcar no existe para él.
--
-- Por defecto false: un trabajo encolado por fuera del panel (o de antes de
-- esta migración) nunca le aparece al cliente por accidente.
alter table public.render_jobs add column if not exists compartir boolean not null default false;

-- Cuándo se le avisó. Sirve de candado: el script puede reintentar sin que al
-- cliente le lleguen tres correos del mismo previo.
alter table public.render_jobs add column if not exists avisado_en timestamptz;

create index if not exists idx_render_jobs_compartidos on public.render_jobs(proyecto_id)
  where compartir and estado = 'listo';
