-- Previo para músico de sesión: el archivo que se le manda a quien va a grabar
-- (saxor, tololoche, acordeón…) para que ensaye y grabe encima.
--
-- Se separa del previo del cliente porque va a otra persona, con otro nombre de
-- archivo (lleva bpm y tonalidad, que el músico necesita) y por un enlace
-- público de Drive — el músico no tiene cuenta en el sitio.

-- Correo del músico: sin esto no hay a dónde mandarle el previo.
alter table public.musicos add column if not exists email text;

-- A quién se le mandó este render. Null en los otros tipos.
alter table public.render_jobs add column if not exists musico_id uuid references public.musicos(id) on delete set null;

-- Enlace público generado al compartir con el músico. Se guarda para poder
-- revocarlo después: el archivo queda accesible a quien tenga la URL hasta que
-- alguien le quite el permiso.
alter table public.render_jobs add column if not exists enlace_publico text;

alter table public.render_jobs drop constraint if exists render_jobs_tipo_check;
alter table public.render_jobs add constraint render_jobs_tipo_check
  check (tipo in ('previo', 'entregables', 'stems', 'musico'));

create index if not exists idx_render_jobs_musico on public.render_jobs(musico_id)
  where musico_id is not null;
