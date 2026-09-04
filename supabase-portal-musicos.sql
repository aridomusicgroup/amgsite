-- ============================================================================
-- Portal de músicos externos (2026-09-04)
-- ============================================================================
-- Hasta hoy un músico a distancia no existe en el sistema más que como una fila
-- de catálogo y un nombre de texto en un pago. Se verificó contra la base: los
-- 390 responsables de tarea y los 238 de subtarea apuntan TODOS a `equipo`,
-- ninguno a `musicos`. El único puente que existía era
-- `pagos_musico → venta_id → proyecto`, y ese se llena DESPUÉS del trabajo, así
-- que no sirve para decirle a alguien qué le toca grabar.
--
-- Esto crea la liga que falta, más lo mínimo para que suba su parte.
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

-- ── Quién tiene portal ──────────────────────────────────────────────────────
-- Aparte de `activo` a propósito: `activo` quiere decir "le seguimos llamando"
-- (los 9 lo están), y esto quiere decir "tiene cuenta". Arranca apagado para
-- todos; se prende a mano, empezando por Martín Montijo.
alter table public.musicos add column if not exists portal_activo boolean not null default false;

-- ── La asignación: qué toca, en qué proyecto ────────────────────────────────
create table if not exists public.musico_asignaciones (
  id           uuid primary key default gen_random_uuid(),
  musico_id    uuid not null references public.musicos(id)         on delete cascade,
  proyecto_id  uuid not null references public.proyectos(id)       on delete cascade,
  -- La tarea "Grabar Charchetas" que ya se genera sola al crear el proyecto.
  tarea_id     uuid          references public.proyecto_tareas(id) on delete cascade,
  -- El instrumento se guarda AQUÍ y no se hereda de `musicos.instrumentos`:
  -- Adal Oche y Ángel Rocha son los dos tololoche, y Jorge Orlando y Samuel
  -- Torres los dos trombón. Heredarlo es ambiguo desde el primer día.
  instrumento  text not null,
  nota         text,
  estado       text not null default 'pendiente',   -- pendiente | entregado | aceptado
  creado_por   text,
  creado_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (musico_id, tarea_id)
);

create index if not exists idx_musico_asig_musico   on public.musico_asignaciones (musico_id, estado);
create index if not exists idx_musico_asig_proyecto on public.musico_asignaciones (proyecto_id);

-- ── Lo que sube, y por dónde va ─────────────────────────────────────────────
create table if not exists public.musico_archivos (
  id             uuid primary key default gen_random_uuid(),
  asignacion_id  uuid not null references public.musico_asignaciones(id) on delete cascade,
  clase          text not null,            -- 'previo' (mp3, para oír) | 'stem' (wav, la buena)
  nombre         text not null,
  drive_id       text not null,
  bytes          bigint,
  subido_at      timestamptz not null default now(),

  -- Previo: no llega al cliente hasta que alguien del equipo lo aprueba. La
  -- puerta real es `render_jobs.compartir`; esto es el registro de quién y cuándo.
  aprobado_at    timestamptz,
  aprobado_por   text,
  render_job_id  uuid references public.render_jobs(id) on delete set null,

  -- Stem: baja a la PC y se importa al proyecto de REAPER.
  bajado_at      timestamptz,
  ruta_local     text,
  importado_at   timestamptz,
  pista          text,
  error          text
);

create index if not exists idx_musico_arch_asig    on public.musico_archivos (asignacion_id);
-- Las dos colas que lee reaper-sync cada 2 minutos.
create index if not exists idx_musico_arch_bajar   on public.musico_archivos (clase, bajado_at);
create index if not exists idx_musico_arch_aprobar on public.musico_archivos (clase, aprobado_at);

-- ── De qué instrumento a qué pista de REAPER ────────────────────────────────
-- Se sembraron SOLO las que se verificaron una por una contra PLANTILLA.rpp.
-- Charchetas (lo que toca Martín), Tuba, Batería y Acordeón NO tienen pista en
-- la plantilla: se dejan vacías a propósito para que las llene una persona
-- viendo el proyecto, en vez de que el script adivine y meta el audio donde no va.
create table if not exists public.instrumento_pistas (
  instrumento text primary key,
  pista       text not null,
  updated_at  timestamptz not null default now()
);

insert into public.instrumento_pistas (instrumento, pista) values
  ('Trombón',   'TROMBON'),
  ('Tololoche', 'BAJO/TOLO'),
  ('Requinto',  'REQUINTO'),
  ('Armonía',   'ARMONÍA'),
  ('Bass',      'BASS'),
  ('Saxofón',   'SAXOR')
on conflict (instrumento) do nothing;

-- ── De dónde salió un render ────────────────────────────────────────────────
-- El previo que sube un músico se guarda como una fila de `render_jobs` con
-- tipo 'previo' para reutilizar TODO lo que ya existe del lado del cliente (el
-- reproductor, el proxy con Range, el aviso en su panel). Esta columna es lo
-- único que los distingue de un render que sí salió de REAPER.
alter table public.render_jobs add column if not exists origen text not null default 'reaper';

-- RLS prendido y sin policies, igual que `cliente_credenciales`: a estas tablas
-- solo entra el service-role desde las rutas del servidor. El músico no es un
-- usuario de Supabase Auth — su sesión es una cookie firmada por nosotros.
alter table public.musico_asignaciones enable row level security;
alter table public.musico_archivos     enable row level security;
alter table public.instrumento_pistas  enable row level security;

comment on table public.musico_asignaciones is
  'Qué instrumento graba un músico externo en qué tarea de qué proyecto. La liga que no existía entre `musicos` y `proyectos`.';
comment on table public.musico_archivos is
  'Previos y stems que sube un músico desde /musico, y el rastro de su aprobación, bajada e importación a REAPER.';
comment on table public.instrumento_pistas is
  'Instrumento → nombre de pista destino en el .rpp. Editable desde Ajustes; sin fila = pista nueva al final.';
