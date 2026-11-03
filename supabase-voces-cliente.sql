-- ============================================================================
-- Voces del cliente → directo a su sesión de REAPER (2026-11-03)
-- ============================================================================
-- Antes se le pedía al cliente subir sus voces a Drive y alguien del estudio las
-- bajaba y las arrastraba a REAPER a mano. Ahora en su pedido (/cuenta) hay una
-- caja "Tus voces": sube cada WAV a la carpeta de Drive del proyecto, queda
-- anotado aquí, y el script del estudio (reaper-sync/voces.js) lo baja a
-- <proyecto>\VOCES CLIENTE y lo mete en la carpeta VOX GRP del .rpp, una voz por
-- canal: LEAD, PC LEAD, SEGUNDA, REFUERZO y de ahí canales nuevos.
--
-- Sin esta tabla el sitio funciona igual: la caja de voces no aparece y el
-- script no hace nada. Correr en el SQL Editor de Supabase. Idempotente.
-- ============================================================================

create table if not exists public.voces_cliente (
  id            uuid primary key default gen_random_uuid(),
  proyecto_id   uuid not null references public.proyectos(id)       on delete cascade,
  -- En EP/álbum, la canción (cada una es su propio .rpp). Null en lo demás.
  tema_id       uuid          references public.proyecto_tareas(id) on delete cascade,
  nombre        text not null,
  drive_id      text not null unique,
  bytes         bigint,
  subido_por    text,
  subido_at     timestamptz not null default now(),

  -- Lo que llena reaper-sync en la PC del estudio.
  bajado_at     timestamptz,
  ruta_local    text,
  importado_at  timestamptz,
  pista         text,           -- "VOX GRP / LEAD"
  error         text
);

create index if not exists idx_voces_cliente_proyecto on public.voces_cliente (proyecto_id, subido_at);
-- Las dos colas que lee reaper-sync cada 2 minutos.
create index if not exists idx_voces_cliente_bajar    on public.voces_cliente (bajado_at, subido_at)    where error is null;
create index if not exists idx_voces_cliente_importar on public.voces_cliente (importado_at, subido_at) where error is null;

-- RLS prendido y sin policies: sólo entra el service-role desde las rutas del
-- servidor (el cliente no es usuario de Supabase Auth) y desde reaper-sync.
alter table public.voces_cliente enable row level security;

comment on table public.voces_cliente is
  'Voces que sube el cliente desde /cuenta para mezclar; reaper-sync las baja y las mete en VOX GRP de su .rpp.';
