-- ============================================================================
-- Catálogo de DISEÑO VISUAL editable desde el panel (/admin/servicios → Diseño)
-- ============================================================================
-- Antes vivía en data/diseno.json. Ahora vive aquí y el archivo queda de
-- semilla/respaldo: si esta tabla no existe o falla, el sitio sigue con el JSON.
--
-- OJO: cada fila trae el COSTO del diseñador. La tabla no tiene policies (sólo el
-- service-role del backend la lee) y ese costo nunca sale al público: la landing
-- recibe el catálogo sin costo.
--
--   id      estable — NO se cambia (las cotizaciones guardan el nombre)
--   activo  false = oculto de la landing y del selector (nunca se borra)
--   datos   grupo, nombre ES/EN, incluye, precio, costo, componentes…
--
-- Correr en el SQL Editor de Supabase. Idempotente: no pisa lo ya editado.
-- ============================================================================

create table if not exists public.diseno_catalogo (
  id          text        primary key,
  orden       integer     not null default 0,
  activo      boolean     not null default true,
  datos       jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_por text
);

alter table public.diseno_catalogo enable row level security;

insert into public.diseno_catalogo (id, orden, datos) values
  ('lanzamiento-basico', 0, $j${"grupo":"paquete","nombre":{"es":"Paquete Lanzamiento Básico","en":"Basic Release Package"},"incluye":{"es":["Portada (Cover Art)","Canvas de Spotify","Visualizer para YouTube"],"en":["Cover Art","Spotify Canvas","YouTube Visualizer"]},"precio":1050,"costo":700,"componentes":[{"id":"cover-art"},{"id":"canvas"},{"id":"visualizer"}]}$j$::jsonb),
  ('lanzamiento-premium', 1, $j${"grupo":"paquete","nombre":{"es":"Paquete Lanzamiento Premium","en":"Premium Release Package"},"incluye":{"es":["Portada (Cover Art)","Lyric video","Canvas de Spotify","Kit de contenido para redes (5 piezas)"],"en":["Cover Art","Lyric video","Spotify Canvas","Social media kit (5 pieces)"]},"precio":2250,"costo":1500,"destacado":true,"componentes":[{"id":"cover-art"},{"id":"lyric-video"},{"id":"canvas"},{"id":"redes","cantidad":5}]}$j$::jsonb),
  ('identidad-completa', 2, $j${"grupo":"paquete","nombre":{"es":"Paquete Identidad Completa","en":"Full Identity Package"},"incluye":{"es":["Branding de artista","Logo en vectores","Portada (Cover Art)","Visualizer para YouTube","Kit de redes sociales"],"en":["Artist branding","Vector logo","Cover Art","YouTube Visualizer","Social media kit"]},"precio":2250,"costo":1500,"componentes":[{"id":"branding"},{"id":"cover-art"},{"id":"visualizer"}]}$j$::jsonb),
  ('cover-art', 3, $j${"grupo":"servicio","nombre":{"es":"Portada (Cover Art)","en":"Cover Art"},"incluye":{"es":["Concepto creativo","Diseño en alta resolución","Formatos para plataformas digitales","1 ronda de cambios"],"en":["Creative concept","High-resolution design","Formats for digital platforms","1 round of changes"]},"precio":450,"costo":300}$j$::jsonb),
  ('cover-canvas', 4, $j${"grupo":"servicio","nombre":{"es":"Portada + Canvas de Spotify","en":"Cover Art + Spotify Canvas"},"incluye":{"es":["Portada completa en alta resolución","Canvas vertical de 8 s para Spotify","1 ronda de cambios en cada uno"],"en":["Full high-resolution cover","8-second vertical Spotify Canvas","1 round of changes on each"]},"precio":700,"costo":500,"componentes":[{"id":"cover-art"},{"id":"canvas"}]}$j$::jsonb),
  ('canvas', 5, $j${"grupo":"servicio","nombre":{"es":"Canvas de Spotify","en":"Spotify Canvas"},"incluye":{"es":["Video vertical de 8 segundos","Con las especificaciones de Spotify","Alta calidad","1 ronda de cambios"],"en":["8-second vertical video","Built to Spotify's specs","High quality","1 round of changes"]},"precio":350,"costo":250}$j$::jsonb),
  ('visualizer', 6, $j${"grupo":"servicio","nombre":{"es":"Visualizer para YouTube","en":"YouTube Visualizer"},"incluye":{"es":["Tu portada animada con efectos visuales","Sincronizado con tu audio","Exportación en Full HD"],"en":["Your cover animated with visual effects","Synced to your audio","Full HD export"]},"precio":750,"costo":500}$j$::jsonb),
  ('lyric-video', 7, $j${"grupo":"servicio","nombre":{"es":"Lyric video","en":"Lyric video"},"incluye":{"es":["Letra animada y sincronizada","Efectos visuales","Full HD"],"en":["Animated, synced lyrics","Visual effects","Full HD"]},"precio":1500,"costo":1000}$j$::jsonb),
  ('logo', 8, $j${"grupo":"servicio","nombre":{"es":"Logo de artista","en":"Artist logo"},"incluye":{"es":["Propuesta de identidad visual","Vectores AI, SVG y PDF","PNG con fondo transparente","Versiones para redes sociales"],"en":["Visual identity proposal","AI, SVG and PDF vectors","Transparent PNG","Social media versions"]},"precio":750,"costo":500}$j$::jsonb),
  ('branding', 9, $j${"grupo":"servicio","nombre":{"es":"Branding de artista","en":"Artist branding"},"incluye":{"es":["Logo","Paleta de colores","Tipografía","Lineamientos visuales","Kit básico de identidad"],"en":["Logo","Color palette","Typography","Visual guidelines","Basic identity kit"]},"precio":1500,"costo":1000}$j$::jsonb),
  ('redes', 10, $j${"grupo":"servicio","nombre":{"es":"Contenido para redes (por pieza)","en":"Social media content (per piece)"},"incluye":{"es":["Publicaciones, historias, banners o reels gráficos","Adaptado a Instagram, Facebook y TikTok"],"en":["Posts, stories, banners or graphic reels","Adapted to Instagram, Facebook and TikTok"]},"precio":150,"costo":100,"unidad":{"es":"pieza","en":"piece"},"desde":true}$j$::jsonb),
  ('urgente-24', 11, $j${"grupo":"adicional","nombre":{"es":"Entrega urgente en 24 h","en":"Rush delivery in 24 h"},"incluye":{"es":[],"en":[]},"precio":250,"costo":150}$j$::jsonb),
  ('urgente-48', 12, $j${"grupo":"adicional","nombre":{"es":"Entrega urgente en 48 h","en":"Rush delivery in 48 h"},"incluye":{"es":[],"en":[]},"precio":150,"costo":100}$j$::jsonb),
  ('formato-extra', 13, $j${"grupo":"adicional","nombre":{"es":"Adaptación a formato adicional","en":"Extra format adaptation"},"incluye":{"es":[],"en":[]},"precio":80,"costo":50}$j$::jsonb),
  ('editables', 14, $j${"grupo":"adicional","nombre":{"es":"Archivos editables","en":"Editable source files"},"incluye":{"es":[],"en":[]},"precio":300,"costo":200}$j$::jsonb)
on conflict (id) do nothing;
