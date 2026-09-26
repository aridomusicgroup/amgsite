-- Ficha de cada beat en el panel (/admin/beats/<id>).
--
-- Por qué una tabla aparte (igual que beat_carpetas):
--   · Los 52 beats "original" viven en data/beats-beatstars.json, que en Vercel
--     es de solo lectura: no hay forma de editarlos sin volver a desplegar.
--   · Meter un original en la tabla `beats` lo REEMPLAZA entero en el catálogo
--     (lib/catalog.ts): si a esa fila le falta la portada o el audio, el beat
--     sale en blanco en la tienda.
--
-- Esta tabla es una CAPA ENCIMA: cada columna vacía (null) significa "usa lo de
-- siempre". Sirve igual para originales y agregados, y "Restablecer" es poner
-- la columna en null. El JSON nunca se toca.
--
-- Orden de prioridad: beat_ficha > fila de `beats` > beats-beatstars.json.

create table if not exists public.beat_ficha (
  beat_id            text primary key,
  bpm                int,
  tonalidad          text,
  genero             text,
  artistas           text[],
  mood               text,
  tags               text[],
  descripcion        text,
  -- Ajuste de precio por licencia, en USD. Sólo las llaves presentes cambian:
  -- {"basic": 30, "premium": 60, "premium-plus": 120, "exclusive": 800}.
  precios            jsonb,
  -- Exclusiva: 'directa' (se compra en el sitio) o 'negociar' (WhatsApp /
  -- BeatStars). null = la regla de siempre (data/legacy-beats.json).
  exclusiva_modo     text,
  portada_url        text,
  portada_chica_url  text,
  oculto             boolean not null default false,
  destacado          boolean not null default false,
  notas              text,
  actualizado_por    text,
  updated_at         timestamptz not null default now()
);

do $$ begin
  alter table public.beat_ficha add constraint beat_ficha_exclusiva_modo_valido
    check (exclusiva_modo is null or exclusiva_modo in ('directa', 'negociar'));
exception when duplicate_object then null; end $$;

alter table public.beat_ficha enable row level security;

comment on table public.beat_ficha is
  'Capa encima del catálogo de beats: lo editado desde el panel gana sobre el JSON y la tabla beats. null = lo de siempre.';

-- En qué video / reel salió cada beat.
create table if not exists public.beat_publicaciones (
  id                 uuid primary key default gen_random_uuid(),
  beat_id            text not null,
  canal              text not null,
  url                text not null,
  titulo             text,
  miniatura          text,
  publicado_at       date,
  -- Si es un reel de Instagram que ya sincronizamos, sus números salen de ahí.
  social_post_id     uuid references public.social_posts(id) on delete set null,
  -- Sólo YouTube: incrustar el video en la página pública del beat.
  mostrar_en_tienda  boolean not null default false,
  creado_por         text,
  created_at         timestamptz not null default now()
);

do $$ begin
  alter table public.beat_publicaciones add constraint beat_publicaciones_canal_valido
    check (canal in ('youtube', 'instagram', 'tiktok', 'facebook', 'otro'));
exception when duplicate_object then null; end $$;

create index if not exists idx_beat_publicaciones_beat on public.beat_publicaciones(beat_id);
create unique index if not exists uq_beat_publicaciones_url on public.beat_publicaciones(beat_id, url);

alter table public.beat_publicaciones enable row level security;

-- Portadas propias. Público de lectura (se pintan en la tienda); la ESCRITURA
-- sólo la hace nuestra API con service-role (app/api/admin/beats/[id]/portada).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portadas-beats', 'portadas-beats', true, 2097152, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Qué beat y qué licencia fue cada renglón de un pedido del sitio.
--
-- Hasta hoy la licencia se ADIVINABA por el monto ($25 básica, $50 premium…).
-- Con precios por beat eso deja de servir: un Premium a $70 entregaría la
-- carpeta entera. Los pedidos viejos quedan en null y se siguen leyendo por monto.
alter table public.order_items add column if not exists beat_id text;
alter table public.order_items add column if not exists license_id text;

-- Verificación: debe regresar 6 renglones.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('beat_ficha', 'precios'), ('beat_ficha', 'oculto'), ('beat_ficha', 'portada_url'),
    ('beat_publicaciones', 'social_post_id'),
    ('order_items', 'beat_id'), ('order_items', 'license_id')
  );
