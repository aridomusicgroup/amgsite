-- Cursos v2: plantilla pedagógica, rutas optativas, entregas con
-- retroalimentación, quizzes, bitácora de práctica, certificados, venta por
-- Stripe y mentoría mensual (lista para encenderse). Idempotente: se puede
-- correr varias veces. Requiere supabase-cursos.sql (v1) ya corrido.
--
-- ⚠ Correr ANTES de desplegar el código que lo usa: pedir una columna que aún
-- no existe vacía la pantalla entera.

-- ── cursos ──────────────────────────────────────────────────────────────────
alter table public.cursos add column if not exists tipo text not null default 'curso';
alter table public.cursos add column if not exists revisiones_incluidas int not null default 1;
-- Textos de llamados, WhatsApp, tráiler y el interruptor de la mentoría:
-- { mentoria: { estado: 'oculta'|'lista_espera'|'abierta', curso_id, precio_mes }, ... }
alter table public.cursos add column if not exists config jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.cursos add constraint cursos_tipo_check check (tipo in ('curso', 'mentoria'));
exception when duplicate_object then null; end $$;

-- ── módulos: a qué ruta pertenecen ──────────────────────────────────────────
alter table public.curso_modulos add column if not exists ruta text not null default 'principal';
alter table public.curso_modulos add column if not exists descripcion text;
do $$ begin
  alter table public.curso_modulos add constraint curso_modulos_ruta_check
    check (ruta in ('principal', 'profunda', 'evaluacion', 'bonus'));
exception when duplicate_object then null; end $$;

-- ── lecciones ───────────────────────────────────────────────────────────────
alter table public.curso_lecciones drop constraint if exists curso_lecciones_tipo_check;
alter table public.curso_lecciones add constraint curso_lecciones_tipo_check
  check (tipo in ('video', 'pdf', 'link', 'tab', 'quiz', 'entrega', 'texto', 'en_vivo'));

alter table public.curso_lecciones add column if not exists etiqueta text not null default 'nucleo';
alter table public.curso_lecciones add column if not exists opcional boolean not null default false;
alter table public.curso_lecciones add column if not exists preview boolean not null default false;
alter table public.curso_lecciones add column if not exists cta text not null default 'ninguno';
-- El guion/plantilla de la lección ([RELLENAR]), quiz, rúbrica y datos de sesión en vivo.
alter table public.curso_lecciones add column if not exists contenido jsonb not null default '{}'::jsonb;
-- [{ t: segundos, label }]
alter table public.curso_lecciones add column if not exists marcadores jsonb not null default '[]'::jsonb;
-- [{ titulo, drive_file_id, tipo }]
alter table public.curso_lecciones add column if not exists recursos jsonb not null default '[]'::jsonb;
alter table public.curso_lecciones add column if not exists estado_produccion text not null default 'guion';

-- `publicada` nace en false (las lecciones de la plantilla no se ven hasta
-- grabarlas), pero las que YA tenían archivo antes de esta migración se
-- publican una sola vez, para no esconder lo que ya estaba al aire.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'curso_lecciones' and column_name = 'publicada'
  ) then
    alter table public.curso_lecciones add column publicada boolean not null default false;
    update public.curso_lecciones set publicada = true
      where drive_file_id is not null or url_externa is not null;
  end if;
end $$;

do $$ begin
  alter table public.curso_lecciones add constraint curso_lecciones_etiqueta_check
    check (etiqueta in ('nucleo', 'capsula', 'filosofia', 'herramienta', 'profunda', 'evaluacion'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.curso_lecciones add constraint curso_lecciones_cta_check
    check (cta in ('ninguno', 'revision', 'mentoria', 'estudio', 'whatsapp'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.curso_lecciones add constraint curso_lecciones_estado_produccion_check
    check (estado_produccion in ('guion', 'listo_grabar', 'grabado', 'editado'));
exception when duplicate_object then null; end $$;

-- ── accesos con vencimiento (null = de por vida; la mentoría vence cada mes) ─
alter table public.curso_accesos add column if not exists vence_en timestamptz;

-- ── progreso: puntaje de quiz y datos extra ─────────────────────────────────
alter table public.curso_progreso add column if not exists datos jsonb not null default '{}'::jsonb;

-- ── entregas de los alumnos (evaluaciones y retos) ──────────────────────────
create table if not exists public.curso_entregas (
  id                uuid primary key default gen_random_uuid(),
  leccion_id        uuid not null references public.curso_lecciones(id) on delete cascade,
  curso_id          uuid not null references public.cursos(id) on delete cascade,
  email             text not null,
  drive_file_id     text not null,
  nombre            text not null,
  bytes             bigint,
  mime              text,
  autoevaluacion    jsonb not null default '{}'::jsonb,  -- { criterio: nivel 1-4 }
  comentario_alumno text,
  estado            text not null default 'enviada' check (estado in ('enviada', 'revisada')),
  con_revision      boolean not null default true,        -- false = ya usó sus revisiones incluidas
  retro             text,
  rubrica_profe     jsonb not null default '{}'::jsonb,
  retro_por         text,
  revisada_en       timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_curso_entregas_curso on public.curso_entregas(curso_id, estado);
create index if not exists idx_curso_entregas_email on public.curso_entregas(lower(email));

-- ── bitácora de práctica (el hábito hecho visible) ──────────────────────────
create table if not exists public.curso_practica (
  id         uuid primary key default gen_random_uuid(),
  curso_id   uuid not null references public.cursos(id) on delete cascade,
  email      text not null,
  fecha      date not null,
  minutos    int not null check (minutos between 1 and 600),
  nota       text,
  created_at timestamptz not null default now()
);
create index if not exists idx_curso_practica_email on public.curso_practica(curso_id, lower(email), fecha);

-- ── interesados (lista de espera de la mentoría) ────────────────────────────
create table if not exists public.curso_interes (
  id         uuid primary key default gen_random_uuid(),
  producto   text not null default 'mentoria',
  email      text not null,
  curso_id   uuid references public.cursos(id) on delete set null,
  leccion_id uuid references public.curso_lecciones(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (producto, email)
);

-- ── certificados (con página pública de verificación) ───────────────────────
create table if not exists public.curso_certificados (
  id         uuid primary key default gen_random_uuid(),
  curso_id   uuid not null references public.cursos(id) on delete cascade,
  email      text not null,
  nombre     text not null,
  tipo       text not null check (tipo in ('termino', 'mencion')),
  emitido_en timestamptz not null default now(),
  unique (curso_id, email, tipo)
);

alter table public.curso_entregas     enable row level security;
alter table public.curso_practica     enable row level security;
alter table public.curso_interes      enable row level security;
alter table public.curso_certificados enable row level security;

-- ── Tiempo real: la bandeja de entregas se actualiza sola en el panel ───────
-- Mismo patrón que supabase-realtime-todo.sql (requiere public.is_staff()).
do $$ begin
  if exists (select 1 from pg_proc where proname = 'is_staff') then
    drop policy if exists staff_rt_read on public.curso_entregas;
    create policy staff_rt_read on public.curso_entregas for select to authenticated using (public.is_staff());
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'curso_entregas'
    ) then
      alter publication supabase_realtime add table public.curso_entregas;
    end if;
  end if;
end $$;
