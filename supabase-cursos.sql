-- Cursos vendibles con material en Drive, mostrados en el panel del cliente
-- (/cuenta). El acceso se decide SOLO por `curso_accesos` (correo, igual que
-- contratos/pedidos vía emailsDeCliente — no por user id, así los alias
-- ligados en Clientes ven lo mismo). Idempotente.

create table if not exists public.cursos (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  titulo         text not null,
  descripcion    text,
  portada_url    text,
  precio_mxn     numeric,
  activo         boolean not null default true,
  drive_folder_id text,          -- carpeta raíz del curso en Drive (autoría)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.curso_modulos (
  id         uuid primary key default gen_random_uuid(),
  curso_id   uuid not null references public.cursos(id) on delete cascade,
  titulo     text not null,
  orden      int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_curso_modulos_curso on public.curso_modulos(curso_id);

create table if not exists public.curso_lecciones (
  id           uuid primary key default gen_random_uuid(),
  modulo_id    uuid not null references public.curso_modulos(id) on delete cascade,
  titulo       text not null,
  tipo         text not null default 'video' check (tipo in ('video', 'pdf', 'link')),
  drive_file_id text,           -- video o pdf servido por el proxy de streaming
  url_externa  text,            -- solo para tipo 'link'
  duracion_seg int,
  orden        int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_curso_lecciones_modulo on public.curso_lecciones(modulo_id);

-- La única tabla que de verdad decide quién entra a un curso.
create table if not exists public.curso_accesos (
  id            uuid primary key default gen_random_uuid(),
  curso_id      uuid not null references public.cursos(id) on delete cascade,
  email         text not null,
  origen        text not null default 'manual' check (origen in ('manual', 'venta', 'regalo')),
  venta_id      uuid references public.ventas(id) on delete set null,
  otorgado_por  text,           -- correo del staff que dio el acceso a mano
  created_at    timestamptz not null default now(),
  unique (curso_id, email)
);
create index if not exists idx_curso_accesos_email on public.curso_accesos(lower(email));

create table if not exists public.curso_progreso (
  id             uuid primary key default gen_random_uuid(),
  leccion_id     uuid not null references public.curso_lecciones(id) on delete cascade,
  email          text not null,
  visto          boolean not null default false,
  visto_en       timestamptz,
  segundos_vistos int not null default 0,
  updated_at     timestamptz not null default now(),
  unique (leccion_id, email)
);
create index if not exists idx_curso_progreso_email on public.curso_progreso(lower(email));

alter table public.cursos          enable row level security;
alter table public.curso_modulos   enable row level security;
alter table public.curso_lecciones enable row level security;
alter table public.curso_accesos   enable row level security;
alter table public.curso_progreso  enable row level security;
