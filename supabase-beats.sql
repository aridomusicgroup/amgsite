-- Tabla para beats agregados desde el admin (sin deploy).
-- Los 53 beats originales siguen en data/beats-beatstars.json; estos son los NUEVOS.
-- /api/beats fusiona ambos (estos primero = más nuevos).

create table if not exists public.beats (
  id              text primary key,          -- TKxxxxxxxx (id de BeatStars)
  title           text not null,
  bpm             int     default 0,
  key             text,                       -- crudo (ej. D_SHARP_MINOR) o vacío
  genres          text[]  default array['LATIN'],
  moods           text[]  default array[]::text[],
  price           numeric default 25,
  plays           int     default 0,
  likes           int     default 0,
  tags            text[]  default array[]::text[],
  artwork_url     text,
  artwork_large   text,
  preview_url     text,
  hls_url         text,
  waveform_url    text,
  beatstars_url   text,
  drive_folder_id text,                       -- carpeta general en Drive
  drive_subfolders jsonb,                     -- {"MP3":"..","WAV":"..","STEMS":".."}
  active          boolean default true,
  created_at      timestamptz default now()
);

-- RLS: solo service-role (igual que el resto de tablas). Sin policies públicas.
alter table public.beats enable row level security;
