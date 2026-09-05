-- ============================================================================
-- Qué .rpp se copia para cada servicio (2026-09-05)
-- ============================================================================
-- Hoy TODA producción nace del mismo PLANTILLA.rpp. Se midió el archivo: 47
-- pistas, y NINGUNA se llama BATERÍA, ACORDEÓN, BAJOQUINTO, TUBA, TROMPETA ni
-- SAXOR. O sea que un "Paquete Empedes" ($8,600: bajoquinto, bass, acordeón,
-- batería) recibe hoy una plantilla donde 3 de sus 4 instrumentos no tienen
-- dónde caer, y un Beat Urbano arrastra 47 pistas que nadie va a tocar.
--
-- Las plantillas las arma UNA PERSONA en REAPER. Esto sólo dice cuál se copia.
-- Nada se genera ni se recorta por código, a propósito: la plantilla tiene 27
-- envíos (AUXRECV) que apuntan a otras pistas POR ÍNDICE, así que borrar una
-- correría los índices y dejaría los 27 envíos apuntando a la pista equivocada.
-- Eso no truena — suena mal, y nadie se entera hasta abrir la mezcla.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

create table if not exists public.reaper_plantillas (
  -- 'paquete' = id de data/services.json (tumbes|alucines|empedes|urbano|scratch)
  -- 'tipo'    = proyectos.tipo (beat_personalizado, grabacion, mezcla_master…)
  --
  -- El PAQUETE manda sobre el TIPO porque el tipo no dice nada de la
  -- instrumentación: los tres paquetes de producción (Tumbes, Alucines,
  -- Empedes) caen todos en tipo='grabacion' — por el MAPA_TIPO de
  -- venta-desde-cotizacion.ts y por el regex /grabaci/ de ventas/route.ts — y
  -- son tres instrumentaciones distintas. El tipo es la red de abajo, para lo
  -- que no viene de un paquete del catálogo.
  ambito      text not null check (ambito in ('paquete', 'tipo')),
  llave       text not null,

  -- SÓLO el nombre del archivo, dentro de la raíz de ROOT. Nunca una ruta: esto
  -- termina en un path.join() del script local, y un '..' saldría de
  -- X:\REAPER Media\LATINOGANG para copiar cualquier archivo del disco. Se
  -- valida aquí Y en la API Y en el script, porque quien escribe la fila no es
  -- siempre quien la lee: el script tiene el service-role y podría toparse con
  -- una fila metida por fuera del panel.
  archivo     text not null check (
                archivo ~ '\.[Rr][Pp][Pp]$'
                and archivo !~ '[\\/:*?"<>|]'
                and archivo not like '%..%'
                and length(archivo) between 5 and 200
              ),

  -- Cómo reconocer este paquete en el TEXTO LIBRE de la cotización, que es lo
  -- único que hay: cotizaciones.items[].label lo llena un <select> con el
  -- catálogo, pero no hay llave a ningún catálogo de servicios — es texto y se
  -- puede editar a mano. Separados por coma, se comparan sin acentos y en
  -- minúsculas. Ej: 'Paquete Empedes, Empedes, norteña'
  alias       text,

  activo      boolean not null default true,
  nota        text,
  updated_at  timestamptz not null default now(),
  updated_por text,
  primary key (ambito, llave)
);

-- ── Qué .rpp hay HOY en el disco ────────────────────────────────────────────
-- Existe por la MISMA razón que `render_inventario`: el panel corre en Vercel y
-- no puede leer X:\. Sin esto, la pantalla de Ajustes te dejaría escribir el
-- nombre de un archivo inexistente y no te enterarías hasta que un proyecto
-- naciera con la plantilla general.
--
-- Una sola fila con un jsonb, y no una fila por archivo, porque el barrido de
-- "borra lo que ya no está" que usa inventario.js filtra con
-- .not('clave','in','(…)'), y un nombre de archivo de Windows con coma o
-- espacio rompe ese filtro. Allá las llaves son UUIDs; aquí son texto que
-- escribe una persona.
create table if not exists public.reaper_disco (
  id           int primary key default 1 check (id = 1),
  rpps         jsonb not null default '[]'::jsonb,   -- [{archivo, bytes, mtime}]
  root         text,
  escaneado_en timestamptz not null default now()
);
insert into public.reaper_disco (id) values (1) on conflict (id) do nothing;

-- ── Con cuál nació de verdad ────────────────────────────────────────────────
-- Sin esta columna no hay forma de detectar después que el mapa estaba mal el
-- día que se creó el proyecto: `reaper_creado` ya quedó en true y el script no
-- vuelve a mirar ese proyecto nunca. Rehacerlo es manual (borrar la carpeta y
-- poner reaper_creado=false), pero al menos así se ve.
alter table public.proyectos add column if not exists reaper_plantilla text;

-- RLS prendido y sin policies, igual que `instrumento_pistas`: a estas tablas
-- sólo entra el service-role, desde las rutas del servidor y el script local.
alter table public.reaper_plantillas enable row level security;
alter table public.reaper_disco      enable row level security;

comment on table public.reaper_plantillas is
  'Paquete de services.json (o proyectos.tipo) → nombre del .rpp que se copia. Editable desde Ajustes; sin coincidencia = PLANTILLA.rpp general + aviso en la bitácora.';
comment on table public.reaper_disco is
  'Qué .rpp existen en la raíz de ROOT. Lo publica reaper-sync porque el panel corre en Vercel y no ve el disco local.';
comment on column public.proyectos.reaper_plantilla is
  'Con qué archivo .rpp nació este proyecto. Sólo informativo: sirve para detectar un mapeo equivocado a posteriori.';

-- ============================================================================
-- NO se siembra ninguna fila, a propósito.
--
-- Sembrar filas apuntando a archivos que todavía no existen en disco haría que
-- CADA proyecto nuevo disparara un aviso desde el día uno. Con la tabla vacía el
-- comportamiento es idéntico al de siempre: todo sale de PLANTILLA.rpp.
--
-- Para empezar a usarlo:
--   1. Armar el .rpp en REAPER y guardarlo en X:\REAPER Media\LATINOGANG
--      (que NO empiece con "_": listarRpps() ignora esos).
--   2. Esperar una corrida de reaper-sync (2 min) para que aparezca en la lista.
--   3. Ajustes → Plantillas de REAPER → ligar el paquete con el archivo.
--   4. OJO: también hay que llenar `instrumento_pistas` con las pistas nuevas
--      de esa plantilla (BATERIA, ACORDEON, BAJOQUINTO…), o la grabación que
--      mande un músico a distancia seguirá cayendo en una pista suelta al final
--      aunque ahora la pista correcta sí exista.
-- ============================================================================
