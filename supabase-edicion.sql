-- ============================================================================
-- Enviar el proyecto a quien edita y cuantiza (2026-09-05)
-- ============================================================================
-- Hoy, cuando Diego no está en el estudio, la carpeta del proyecto se le
-- comparte por Drive A MANO. Esto lo automatiza SIN volverlo una sincronización.
--
-- El principio que gobierna todo lo de abajo: esto NO es un espejo automático,
-- es una CONVERSACIÓN CON TURNOS NUMERADOS, igual que el portal de músicos.
-- Nada corre solo; cada dirección la dispara una persona con un botón.
--
-- Tamaños medidos, para que se entienda por qué está armado así:
--   EL NECIO = 877 archivos, 1.31 GB · Media/ trae 433 wav de hasta 49 MB
--   Recorrer la carpeta entera: 22 ms. El escaneo NUNCA es el problema.
--
-- Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================


-- ── 1. El envío: un turno de la conversación ────────────────────────────────
-- Es un EVENTO, no una carpeta. La carpeta de Drive es UNA SOLA por proyecto
-- (ver `edicion_carpetas`): si cada envío creara la suya, el segundo envío
-- —"faltaban las charchetas"— dejaría a Diego juntando ENVIO-01 y ENVIO-02 a
-- mano, que es justo el trabajo que se quiere quitar.
create table if not exists public.edicion_envios (
  id           uuid primary key default gen_random_uuid(),

  -- Misma llave que `render_inventario`: tarea_id si es canción de EP/Álbum,
  -- proyecto_id si no. Se reutiliza el concepto en vez de inventar otro — un
  -- índice único sobre (proyecto_id, tarea_id) NO sirve, porque en Postgres dos
  -- filas con tarea_id NULL no se consideran duplicadas.
  clave        text not null,
  proyecto_id  uuid not null references public.proyectos(id)       on delete cascade,
  tarea_id     uuid          references public.proyecto_tareas(id) on delete cascade,

  -- 1, 2, 3… Es lo que una persona ve como "el segundo envío".
  num          int  not null default 1,

  estado       text not null default 'abierto'
               check (estado in ('abierto', 'subiendo', 'listo', 'error', 'cancelado')),

  -- Lo que el estudio le quiere decir en este turno ("ya con las charchetas de
  -- Martín"). Va dentro del aviso.
  nota         text,

  -- A quién avisar, RESUELTO AL ENVIAR y congelado aquí.
  --
  -- Por qué congelado y no deducido al momento del aviso: si se dedujera del
  -- título de la tarea ("Editar y cuantizar"), reasignar esa tarea entre el
  -- envío y el fin de la subida mandaría el aviso a otra persona. Y el correo se
  -- guarda APARTE del id porque `equipo.email` puede quedar en NULL después, y
  -- ahí `lib/push.ts` se traga el aviso EN SILENCIO.
  notificar_a     uuid references public.equipo(id) on delete set null,
  notificar_email text,

  -- Con qué cuenta de Google se compartió la carpeta. Guardarlo permite
  -- revocar el acceso el día que esa persona deje de colaborar, sin adivinar.
  compartido_con  text,

  pedido_por   text,
  creado_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  cerrado_at   timestamptz,
  avisado_en   timestamptz,
  error        text
);

create index if not exists idx_edicion_envios_clave    on public.edicion_envios (clave, num desc);
create index if not exists idx_edicion_envios_proyecto on public.edicion_envios (proyecto_id);

-- EL CANDADO DEL DOBLE CLIC. Sin esto, dos toques seguidos al botón crean dos
-- envíos, los dos reclaman los mismos archivos y a Diego le llegan dos avisos.
-- Es un índice parcial y no un CHECK porque la regla es "a lo más uno VIVO", no
-- "a lo más uno".
create unique index if not exists uniq_edicion_envio_vivo
  on public.edicion_envios (clave) where estado in ('abierto', 'subiendo');

-- El número de turno no se repite ni aunque se cancele un envío.
create unique index if not exists uniq_edicion_envio_num
  on public.edicion_envios (clave, num);


-- ── 2. El manifiesto: una fila por archivo ──────────────────────────────────
-- LA PIEZA CENTRAL. Hace que "resubir sólo lo que falta" y "reanudar una subida
-- que se cortó" sean LA MISMA CONSULTA, no dos funciones. Por eso el botón
-- siempre dice lo mismo: "Enviar lo que falta" — la primera vez, falta todo.
--
-- Y de paso mata la consulta de descubrimiento: hoy `drive.js existente()` le
-- pregunta a Drive por CADA archivo si ya hay uno con ese nombre. Serían 877
-- llamadas por envío, y encima deduplica sólo por nombre DENTRO de una carpeta,
-- así que Media/x.wav y MUSICOS/x.wav se pisarían. Aquí `drive_id` ya lo sabe.
create table if not exists public.edicion_archivos (
  id           uuid primary key default gen_random_uuid(),

  clave        text not null,
  proyecto_id  uuid not null references public.proyectos(id) on delete cascade,

  -- Relativa a la carpeta del proyecto, SIEMPRE con "/" aunque el disco use "\":
  -- de aquí sale el nombre de la subcarpeta en Drive, y un "\" crearía una
  -- carpeta llamada literalmente "Media\29-C414".
  --   "EL NECIO.rpp" | "Media/29-C414-Pegado-01.wav" | "MUSICOS/CHARCHETAS - X.wav"
  ruta_rel     text   not null,
  nombre       text   not null,

  -- Nombre + tamaño es llave suficiente porque en estos proyectos los archivos
  -- SE ACUMULAN, no se reescriben (Pegado-01, -02, -03). Medido, no supuesto.
  bytes        bigint not null,
  -- Entero a propósito, mismo criterio que `render.js listarRpps` y por la misma
  -- razón: va y vuelve de Postgres, y un decimal que no round-tripee exacto
  -- haría creer que el archivo cambió en cada corrida.
  mtime        bigint not null,

  -- Orden de subida. Sin esto el .rpp podría aterrizar al final y quien edita no
  -- podría abrir NADA hasta que llegue el último wav, horas después.
  --   10 .rpp de raíz · 20 mp3 de raíz · 30 MUSICOS · 40 audio
  --   90 .reapeaks (regenerables: si algo se corta, que se corte aquí)
  --   95 respaldos
  prioridad    smallint not null default 40,

  -- En qué turno se subió. NULL = todavía no le ha tocado a ninguno.
  envio_id     uuid references public.edicion_envios(id) on delete set null,

  drive_id     text,          -- presente = reemplazar ese archivo; null = crear
  subido_at    timestamptz,

  -- Reintentos con tope y espera creciente. Hoy NO HAY NINGUNO en todo
  -- reaper-sync, y en `musico_archivos` un fallo escribe `error` y eso excluye
  -- la fila PARA SIEMPRE de la cola. Aquí quien filtra es `intentos`, que se
  -- puede poner en cero desde un botón.
  intentos           smallint not null default 0,
  ultimo_error       text,
  -- DOBLE USO, a propósito: es la espera del backoff Y es el candado. Al tomar
  -- un archivo para subirlo se pone a now()+10min; si el proceso muere a media
  -- subida, el archivo vuelve solo a la cola en 10 minutos, sin que haga falta
  -- ningún detector de atascos. Y dos procesos solapados no pueden tomar el
  -- mismo archivo, porque el UPDATE que lo reclama lleva esta misma condición.
  reintentar_despues timestamptz,

  -- Última corrida en que se vio en el disco. Un `visto_en` viejo quiere decir
  -- "ya no está en el estudio" sin tener que borrar la fila.
  visto_en     timestamptz not null default now(),
  creado_at    timestamptz not null default now(),

  -- (clave, ...) y no (proyecto_id, ...): en un EP dos canciones distintas
  -- tienen las dos un "Media/Pegado-01.wav", y con la llave por proyecto la
  -- segunda canción no podría insertar nada.
  unique (clave, ruta_rel)
);

-- La cola que lee reaper-sync, en un solo índice.
create index if not exists idx_edicion_arch_cola
  on public.edicion_archivos (clave, prioridad, ruta_rel)
  where subido_at is null;
create index if not exists idx_edicion_arch_proyecto on public.edicion_archivos (proyecto_id);
create index if not exists idx_edicion_arch_envio    on public.edicion_archivos (envio_id);


-- ── 3. El espejo del árbol en Drive ─────────────────────────────────────────
-- `ruta_rel = "Media/x.wav"` exige que exista EDICION/Media/ en Drive. El script
-- NO tiene credenciales de Google (viven en un solo lugar, por diseño), así que
-- le pide los ids al sitio y los cachea aquí. Sin esta tabla serían 877
-- llamadas de "buscar o crear carpeta"; con ella son tres.
create table if not exists public.edicion_carpetas (
  clave     text not null,
  -- "" = la carpeta EDICION del proyecto. Si no, la subruta con "/".
  subruta   text not null,
  drive_id  text not null,
  creado_at timestamptz not null default now(),
  primary key (clave, subruta)
);


-- ── 4. Las revisiones que devuelve quien edita ──────────────────────────────
-- Sólo el .rpp (~1 MB), nunca audio. Se sube del navegador directo a Drive
-- (mismo mecanismo que ya usa la pestaña Archivos) y reaper-sync la baja a
-- REVISIONES/rev-NN/ en el disco del estudio.
--
-- Por qué a una carpeta propia y NUNCA a la raíz del proyecto, dos razones:
--   1. No debe pisar el proyecto de trabajo. Es la decisión del dueño.
--   2. `adivinarTonalidad()` deduce la tonalidad de los NOMBRES de archivo de la
--      raíz, así que un .rpp extra ahí cambiaría en silencio la tonalidad que el
--      panel ofrece al renderizar.
--
-- Consecuencia buena: como nunca se escribe el .rpp de trabajo, esto NO necesita
-- ninguno de los tres candados de `musicos.js importar()` (REAPER abierto,
-- respaldo previo, no reintentar en bucle). Es bajar un archivo y ya.
create table if not exists public.edicion_revisiones (
  id           uuid primary key default gen_random_uuid(),

  clave        text not null,
  proyecto_id  uuid not null references public.proyectos(id)       on delete cascade,
  tarea_id     uuid          references public.proyecto_tareas(id) on delete cascade,

  num          int  not null,          -- rev-01, rev-02… es lo que se ve en el disco
  nombre       text not null,
  drive_id     text not null,
  bytes        bigint,
  nota         text,

  subido_por   text,
  subido_at    timestamptz not null default now(),

  -- El viaje a la PC del estudio.
  bajado_at    timestamptz,
  ruta_local   text,
  intentos           smallint not null default 0,
  ultimo_error       text,
  reintentar_despues timestamptz,

  unique (clave, num)
);

create index if not exists idx_edicion_rev_bajar    on public.edicion_revisiones (bajado_at, subido_at);
create index if not exists idx_edicion_rev_proyecto on public.edicion_revisiones (proyecto_id);


-- ── 5. RLS ──────────────────────────────────────────────────────────────────
-- Sólo lectura, y sólo staff. Las páginas y las APIs leen con service-role; esta
-- policy gobierna la SUSCRIPCIÓN EN TIEMPO REAL del navegador, que es lo que
-- hace que la barra de progreso se mueva sola sin estar preguntando.
alter table public.edicion_envios     enable row level security;
alter table public.edicion_archivos   enable row level security;
alter table public.edicion_revisiones enable row level security;
alter table public.edicion_carpetas   enable row level security;  -- sin policy: sólo service-role

drop policy if exists staff_rt_read on public.edicion_envios;
create policy staff_rt_read on public.edicion_envios
  for select to authenticated using (public.is_staff());

drop policy if exists staff_rt_read on public.edicion_archivos;
create policy staff_rt_read on public.edicion_archivos
  for select to authenticated using (public.is_staff());

drop policy if exists staff_rt_read on public.edicion_revisiones;
create policy staff_rt_read on public.edicion_revisiones
  for select to authenticated using (public.is_staff());


-- ── 6. Tiempo real ──────────────────────────────────────────────────────────
-- `edicion_archivos` NO se publica a propósito: son 877 filas cambiando durante
-- una subida y saturarían el canal. El progreso se deriva de
-- `edicion_envios.updated_at`, que el script toca al cerrar cada tanda.
do $$
declare t text;
begin
  foreach t in array array['edicion_envios', 'edicion_revisiones'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


comment on table public.edicion_envios is
  'Un turno del envío del proyecto a quien edita. Evento, no carpeta: la carpeta de Drive es una sola por proyecto.';
comment on table public.edicion_archivos is
  'Manifiesto: una fila por archivo del proyecto. Es lo que hace que "resubir lo que falta" y "reanudar" sean la misma operación.';
comment on table public.edicion_carpetas is
  'Espejo del árbol del disco en Drive. Cachea los ids para no pedir "buscar o crear carpeta" por cada archivo.';
comment on table public.edicion_revisiones is
  'El .rpp que devuelve quien edita. Cae en REVISIONES/rev-NN/ del disco; NUNCA pisa el proyecto de trabajo.';
