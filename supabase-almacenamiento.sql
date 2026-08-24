-- Límite de almacenamiento por proyecto activo (subida de archivos del
-- cliente a su carpeta de Drive). Dos niveles: un default por tipo de
-- producción (beat personalizado sube poco — una maqueta; grabación/mezcla
-- suben mucho más — audio crudo), y un override manual por proyecto para el
-- cliente que de plano necesita más espacio.

create table if not exists public.almacenamiento_tipos_default (
  tipo        text primary key,
  limite_mb   integer not null,
  updated_at  timestamptz default now()
);
alter table public.almacenamiento_tipos_default enable row level security;

alter table public.proyectos add column if not exists limite_almacenamiento_mb integer;
comment on column public.proyectos.limite_almacenamiento_mb is
  'Override manual del límite de almacenamiento (MB) para ESTE proyecto — NULL usa el default de su tipo (almacenamiento_tipos_default).';

-- Defaults sugeridos: chico para lo que solo sube una maqueta/demo, grande
-- para lo que necesita audio crudo (multipistas, stems, referencias).
insert into public.almacenamiento_tipos_default (tipo, limite_mb) values
  ('beat_personalizado', 300),
  ('bp_letra', 300),
  ('exclusividad', 500),
  ('grabacion', 3072),
  ('mezcla_master', 5120),
  ('ep', 8192),
  ('album', 15360)
on conflict (tipo) do nothing;
