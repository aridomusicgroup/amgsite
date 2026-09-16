-- ============================================================================
-- DE DÓNDE LLEGA CADA CLIENTE · 2026-09-16 · se puede correr más de una vez.
--
--   contactos.origen_post_id   el reel de Instagram del que llegó
--   contactos.origen_enlace    el video de TikTok / YouTube / Facebook (link)
--   social_posts.tipo_contenido humor · ranking · venta · consejo · proceso · otro
--   social_posts.tipo_manual   true = lo eligió una persona (el automático no lo pisa)
--   clics_enlace               cada clic en los enlaces de los perfiles
--                              (aridomusicgroup.com/ir/tiktok, /ir/youtube…)
--   ig_comentarios_origen      quién comentó la palabra clave y en qué reel
--                              (lo escribe el bot; con eso el contacto sabe su reel)
-- ============================================================================

alter table public.contactos add column if not exists origen_post_id uuid
  references public.social_posts(id) on delete set null;
alter table public.contactos add column if not exists origen_enlace text;

alter table public.social_posts add column if not exists tipo_contenido text;
alter table public.social_posts add column if not exists tipo_manual boolean not null default false;
do $$ begin
  alter table public.social_posts add constraint social_posts_tipo_contenido_valido
    check (tipo_contenido is null or tipo_contenido in ('humor', 'ranking', 'venta', 'consejo', 'proceso', 'otro'));
exception when duplicate_object then null; end $$;

create table if not exists public.clics_enlace (
  id         uuid primary key default gen_random_uuid(),
  canal      text not null,
  ref        text,          -- opcional: de qué video/post (?v=...)
  pais       text,
  creado_at  timestamptz not null default now()
);
create index if not exists idx_clics_enlace_fecha on public.clics_enlace(creado_at desc);
alter table public.clics_enlace enable row level security;

create table if not exists public.ig_comentarios_origen (
  id          uuid primary key default gen_random_uuid(),
  ig_user_id  text not null,
  username    text,
  media_id    text not null,
  regla       text,
  creado_at   timestamptz not null default now()
);
create index if not exists idx_ig_comentarios_usuario on public.ig_comentarios_origen(ig_user_id, creado_at desc);
alter table public.ig_comentarios_origen enable row level security;

-- REVISIÓN: deben salir 6 filas.
select table_name, column_name from information_schema.columns
where table_schema = 'public' and (table_name, column_name) in (
  ('contactos', 'origen_post_id'), ('contactos', 'origen_enlace'),
  ('social_posts', 'tipo_contenido'), ('social_posts', 'tipo_manual'),
  ('clics_enlace', 'canal'), ('ig_comentarios_origen', 'media_id'))
order by 1, 2;
