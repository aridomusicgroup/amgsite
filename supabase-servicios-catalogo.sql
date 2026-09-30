-- ============================================================================
-- Catálogo del cotizador EDITABLE desde el panel (/admin/servicios)
-- ============================================================================
-- Antes vivía en data/services.json y cambiar un precio pedía desplegar. Ahora
-- vive aquí, y el archivo queda sólo de semilla/respaldo: si esta tabla no
-- existe o falla, el sitio sigue con lo que trae el JSON.
--
-- Una fila por paquete, instrumento extra o servicio de estudio:
--   tipo   base | extra | studio
--   id     estable — NO se cambia (las plantillas de REAPER se ligan al id del paquete)
--   activo false = oculto del cotizador público (nunca se borra: hay cotizaciones viejas)
--   datos  el resto (nombres ES/EN, precio, incluye, opciones…)
--
-- Correr en el SQL Editor de Supabase. Idempotente: no pisa lo ya editado.
-- ============================================================================

create table if not exists public.servicios_catalogo (
  tipo        text        not null check (tipo in ('base', 'extra', 'studio')),
  id          text        not null,
  orden       integer     not null default 0,
  activo      boolean     not null default true,
  datos       jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_por text,
  primary key (tipo, id)
);

-- Sin policies: sólo el service-role (backend) lee y escribe.
alter table public.servicios_catalogo enable row level security;

insert into public.servicios_catalogo (tipo, id, orden, datos) values
  ('base', 'tumbes', 0, $j${"name":{"es":"Paquete Tumbes","en":"Tumbes Package"},"tagline":{"es":"Producción tumbada","en":"Tumbado production"},"price":6000,"includes":{"es":["Armonía","Requinto","Bass o bajoloche","Mezcla y master"],"en":["Harmony","Requinto","Bass or bajoloche","Mix & master"]},"includedExtras":[],"choices":[{"id":"low","label":{"es":"Tu bajo","en":"Your low end"},"options":[{"id":"bass","label":{"es":"Bass","en":"Bass"}},{"id":"bajoloche","label":{"es":"Bajoloche","en":"Bajoloche"}}]}]}$j$::jsonb),
  ('base', 'alucines', 1, $j${"name":{"es":"Paquete Alucines","en":"Alucines Package"},"tagline":{"es":"Producción bélica","en":"Bélico production"},"price":8200,"includes":{"es":["Armonía (guitarra o bajoquinto)","Requinto","Tololoche","Charchetas","Trombón","Mezcla y master"],"en":["Harmony (guitar or bajoquinto)","Requinto","Tololoche","Charchetas","Trombone","Mix & master"]},"includedExtras":["tololoche","charchetas","trombon"],"choices":[{"id":"armonia","label":{"es":"Tu armonía","en":"Your harmony"},"options":[{"id":"guitarra","label":{"es":"Guitarra","en":"Guitar"}},{"id":"bajoquinto","label":{"es":"Bajoquinto","en":"Bajoquinto"}}]}]}$j$::jsonb),
  ('base', 'empedes', 2, $j${"name":{"es":"Paquete Empedes","en":"Empedes Package"},"tagline":{"es":"Producción norteña","en":"Norteño production"},"price":8600,"includes":{"es":["Bajoquinto","Bass","Acordeón","Batería","Mezcla y master"],"en":["Bajoquinto","Bass","Accordion","Drums","Mix & master"]},"includedExtras":["acordeon","bateria"],"choices":[]}$j$::jsonb),
  ('base', 'urbano', 3, $j${"name":{"es":"Beat Urbano","en":"Urban Beat"},"tagline":{"es":"Trap, reguetón, afrobeat, dancehall, electrocorrido…","en":"Trap, reggaeton, afrobeat, dancehall, electrocorrido…"},"price":3000,"includes":{"es":["Producción personalizada del género urbano que elijas","Mezcla y master"],"en":["Custom production in the urban genre of your choice","Mix & master"]},"includedExtras":[],"choices":[]}$j$::jsonb),
  ('base', 'scratch', 4, $j${"name":{"es":"Desde cero","en":"From scratch"},"tagline":{"es":"Arma tu propio paquete servicio por servicio","en":"Build your own package service by service"},"price":0,"includes":{"es":[],"en":[]},"includedExtras":[],"choices":[]}$j$::jsonb),
  ('extra', 'trombon', 0, $j${"label":{"es":"Trombón","en":"Trombone"},"price":600,"graba":true}$j$::jsonb),
  ('extra', 'tololoche', 1, $j${"label":{"es":"Tololoche","en":"Tololoche"},"price":600,"graba":true}$j$::jsonb),
  ('extra', 'acordeon', 2, $j${"label":{"es":"Acordeón","en":"Accordion"},"price":600,"graba":true}$j$::jsonb),
  ('extra', 'charchetas', 3, $j${"label":{"es":"Charchetas","en":"Charchetas"},"price":1000,"graba":true}$j$::jsonb),
  ('extra', 'tuba', 4, $j${"label":{"es":"Tuba","en":"Tuba"},"price":1500,"graba":true}$j$::jsonb),
  ('extra', 'bateria', 5, $j${"label":{"es":"Batería","en":"Drums"},"price":2000,"graba":true}$j$::jsonb),
  ('studio', 'mezcla-master', 0, $j${"label":{"es":"Mezcla y master de canción completa","en":"Full song mix & master"},"description":{"es":"Beat o stems + voces, listo para plataformas","en":"Beat or stems + vocals, platform-ready"},"price":2500}$j$::jsonb),
  ('studio', 'mezcla-voces', 1, $j${"label":{"es":"Mezcla de voces","en":"Vocal mix"},"description":{"es":"Únicamente la mezcla de las voces de un tema","en":"Vocal mixing only, for one song"},"price":1500}$j$::jsonb),
  ('studio', 'grab-requinto', 2, $j${"label":{"es":"Grabación de requinto","en":"Requinto recording"},"description":{"es":"Grabación individual, sin mezcla","en":"Individual recording, no mix"},"price":2000}$j$::jsonb),
  ('studio', 'grab-armonia', 3, $j${"label":{"es":"Grabación de armonía o bajoquinto","en":"Harmony or bajoquinto recording"},"description":{"es":"Grabación individual, sin mezcla","en":"Individual recording, no mix"},"price":1500}$j$::jsonb),
  ('studio', 'grab-bass', 4, $j${"label":{"es":"Grabación de bass o bajoloche","en":"Bass or bajoloche recording"},"description":{"es":"Grabación individual, sin mezcla","en":"Individual recording, no mix"},"price":1500}$j$::jsonb)
on conflict (tipo, id) do nothing;
